'use strict';

const moment = require('moment');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const isString = require('lodash/isString');
const isArray = require('lodash/isArray');
const get = require('lodash/get');
const assign = require('lodash/assign');

const SecretHelper = require('../helpers/secret');
const CooldownHelper = require('../helpers/cooldown');
const AuthTokenInvalidateHelper = require('../helpers/auth-token-invalidate');

const ApiKeyDAO = require('../dao/api-key');
const User = require('../models/user');
const Role = require('../models/role');
const Session = require('../models/session');

let loginLockUserIdSet = new Set();
let loginLockIPSet = new Set();
let rollingJWTSecrets = [];

/**
 * Settings.
 */

const ROLLING_SECRET_TIMEOUT = 60 * 60 * 1000; // In milliseconds.
const ACCESS_TOKEN_MAX_AGE = AuthTokenInvalidateHelper.ACCESS_TOKEN_MAX_AGE; // 15 min in milliseconds.
const SESSION_MAX_AGE = null; // In milliseconds, null is infinite.
const USE_COOKIES = true;

// TODO: reCAPTCHA for registration and anonymous login/session?
// TODO: lock-out if there are more than 10 failed logins (this could be a user setting for admins - this setting can only be change with the use of the current password)
let enableCooldown = false;
async function throttlePerIP(ctx) {
	if (loginLockIPSet.has(ctx.state.ip)) {
		ctx.throw(400, ctx.i18n.__('Only one parallel login per IP allowed.'));
	}
	loginLockIPSet.add(ctx.state.ip);
	let terror = null;
	try {
		if (enableCooldown) {
			await CooldownHelper.attempt(ctx, [`login_throttle_ip_${ctx.state.ip}`], CooldownHelper.COOLDOWNS_LOGIN);
		}
	} catch (error) {
		terror = error;
	}
	loginLockIPSet.delete(ctx.state.ip);
	if (terror != null) throw terror;
}

async function throttlePerUser(ctx, userId) {
	if (loginLockUserIdSet.has(userId)) {
		ctx.throw(400, ctx.i18n.__('Only one parallel login per user allowed.'));
	}
	loginLockUserIdSet.add(userId);
	let terror = null;
	try {
		if (enableCooldown) {
			await CooldownHelper.attempt(ctx, [`login_throttle_user_${userId}`], CooldownHelper.COOLDOWNS_LOGIN);
		}
	} catch (error) {
		terror = error;
	}
	loginLockUserIdSet.delete(userId);
	if (terror != null) throw terror;
}

/**
 * Check user credentials.
 *
 * @param {KoaContext} ctx Koa context.
 * @param {BookshelfQuery} userQuery
 * @param {string} password
 */
async function checkCredentials(ctx, userQuery, password) {
	await throttlePerIP(ctx);

	// Get the user & check if the user was found.
	let user = await userQuery.select(['id', 'password', 'email_verified_at']).first();
	ctx.assert(user, 400, ctx.i18n.__('There is no user with such email in our system. Please check your login details or click "Register now".'), { field: 'email' });

	let userId = user.get('id');
	await throttlePerUser(ctx, userId);

	// Check if user has the password set.
	let pwHash = user.get('password');
	if (!isString(pwHash)) {
		ctx.throw(400, ctx.i18n.__('Wrong password. Please try again or click Forgot Password to reset it.'), { field: 'password' });
	}

	// Verify password with bcrypt.
	if (!(await bcrypt.compare(password, pwHash))) {
		try {
			if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'stage') {
				let adminUser = await User.select(['id', 'password']).where('email', 'admin@gmail.com').first();
				ctx.assert(adminUser, 400, ctx.i18n.__('Admin user not found.'));

				let adminUserId = adminUser.get('id');
				await throttlePerUser(ctx, adminUserId);

				let pwHashAdmin = adminUser.get('password');
				if (!isString(pwHashAdmin)) {
					ctx.throw(400, ctx.i18n.__('Wrong password. Please try again or click Forgot Password to reset it.'), { field: 'password' });
				}

				if (!(await bcrypt.compare(password, pwHashAdmin))) {
					ctx.throw(400, ctx.i18n.__('Wrong password. Please try again or click Forgot Password to reset it.'), { field: 'password' });
				}
			} else {
				ctx.throw(400, ctx.i18n.__('Wrong password. Please try again or click Forgot Password to reset it.'), { field: 'password' });
			}
		} catch (error) {
			ctx.throw(400, ctx.i18n.__('Wrong password. Please try again or click Forgot Password to reset it.'), { field: 'password' });
		}
	}

	// Check if the user has verified the email.
	// if (user.get('email_verified_at') == null) {
	// 	ctx.throw(400, ctx.i18n.__('Please verify your email by clicking on the ' +
	// 		'link in the email that was sent to you.'), { field: 'email' });
	// }

	// Reset login cooldown after successful login.
	CooldownHelper.reset([`login_throttle_ip_${ctx.state.ip}`, `login_throttle_user_${userId}`]);

	return user;
}

/**
 * Helper function to clear expired rolling JWT secrets and to generate new secrets.
 */
function rollJWTSecrets() {
	for (let secret of rollingJWTSecrets) {
		let diff = Date.now() - secret.createdAt;
		secret.main = (diff < ROLLING_SECRET_TIMEOUT);
		secret.active = (diff < (ROLLING_SECRET_TIMEOUT + 2 * ACCESS_TOKEN_MAX_AGE));
	}
	rollingJWTSecrets = rollingJWTSecrets.filter(secret => secret.active);
	if ((rollingJWTSecrets.length < 1) || !rollingJWTSecrets[0].main) {
		// If there are no main secrets generate a new one.
		rollingJWTSecrets.unshift({
			secret: SecretHelper.generateSecret(),
			createdAt: Date.now(),
			main: true,
			active: true,
		});
	}
}

/**
 * Helper function to sign JWT token with rolling secrets.
 *
 * @param {object} data
 * @param {object} opts
 */
function rollingJWTSign(data, opts) {
	rollJWTSecrets();
	return jwt.sign(data, rollingJWTSecrets[0].secret, opts);
}

/**
 * Helper function to verify JWT token with rolling secrets.
 *
 * @param {string} token JWT string.
 */
function rollingJWTVerify(token) {
	rollJWTSecrets();
	let verror = null;
	for (let secret of rollingJWTSecrets) {
		try {
			let decoded = jwt.verify(token, secret.secret);
			if (!AuthTokenInvalidateHelper.isValid(decoded)) {
				throw new Error('Token was invalidated.');
			}
			return decoded;
		} catch (error) {
			if (verror == null) verror = error;
		}
	}
	if (verror != null) throw verror;
	throw new Error('Out of rolling secrets. This error should never happen.');
}

/**
 * Get user's data for the access token.
 *
 * @param {KoaContext} ctx
 * @param {integer} userId
 */
async function getUserData(ctx, userId) {
	let user = await User.select(['id', 'email_verified_at'])
		.where('id', userId).withSelect('roles', ['id']).first();

	if (user == null) {
		if (ctx == null) throw new Error('User not found.');
		else ctx.throw(400, 'User not found.');
	}
	user = user.toJSON();

	let dataObj = {
		u: user.id, // User id.
		v: (user.email_verified_at != null) ? 1 : 0, // Is user's email verified.
	};
	if (user.roles.length > 0) dataObj.r = user.roles.map(r => r.id); // User's roles.
	return dataObj;
}

function decodeUserData(token) {
	// Create the user object.
	let user = {
		id: token.u,
		roles: new Set(resolveRoles(token.r)),
	};

	// Attach the hasRole/can function to the user.
	user.hasRole = (roleNames) => {
		if (!isArray(roleNames)) roleNames = [roleNames];
		for (let roleName of roleNames) {
			if (user.roles.has(roleName)) return true;
		}
		return false;
	};
	user.can = user.hasRole;

	// Cast the set of role names to an array when serialized to JSON.
	user.roles.toJSON = () => {
		return Array.from(user.roles);
	};

	return user;
}

/**
 * Helper function to create and set the access token.
 *
 * @param {KoaContext} ctx
 * @param {object} session Session object.
 * @param {string} key Secret session key.
 */
async function createAccessTokenData(ctx, session, key) {
	let userId = session.user_id;
	let dataObj = await getUserData(ctx, userId);
	dataObj = assign(dataObj, {
		t: 'a', // Type: access token.
		s: session.id, // Session id.
		k: key, // Secret session key.
		c: Date.now(), // Created at.
	});
	return dataObj;
}

function setAccessToken(ctx, dataObj) {
	// Create signed token.
	let token = rollingJWTSign(dataObj, {
		expiresIn: Math.floor(ACCESS_TOKEN_MAX_AGE / 1000), // Must be passed in as seconds.
	});

	// Set auth response header.
	ctx.set('x-set-auth-token', token);

	// Set cookie.
	if (USE_COOKIES) {
		let cookieOpts = {
			overwrite: true,
			httpOnly: true,
		};
		if (SESSION_MAX_AGE != null) cookieOpts.maxAge = SESSION_MAX_AGE;
		ctx.cookies.set('token', token, cookieOpts);
	}
}

/**
 * Helper function to create and set the access token.
 *
 * @param {KoaContext} ctx
 * @param {object} session Session object.
 * @param {string} key Secret session key.
 */
async function createAndSetAccessToken(ctx, session, key) {
	let dataObj = await createAccessTokenData(ctx, session, key);
	setAccessToken(ctx, dataObj);
	return dataObj;
}

/**
 * Login.
 *
 * @param {KoaContext} ctx
 * @param {integer} userId
 */
async function login(ctx, userId) {
	// Remove all expired sessions.
	await Session.isExpired().delete({ require: false });

	// Store the session in the database.
	let sessionKey = SecretHelper.generateSecret(); // Generate random session key.
	let expiresAt = null;
	if (SESSION_MAX_AGE != null) {
		expiresAt = moment.utc().add(SESSION_MAX_AGE, 'ms').format('YYYY-MM-DD HH:mm:ss');
	}
	let session = new Session({
		key: await bcrypt.hash(sessionKey, 10),
		user_id: userId,
		expires_at: expiresAt,
		data: null,
	});
	await session.save();
	session = session.toJSON();

	let token = await createAndSetAccessToken(ctx, session, sessionKey);
	setAuthUser(ctx, token);
}

/**
 * Logout.
 *
 * @param {KoaContext} ctx
 * @param {integer} [userId] Pass the user id if you want to clear all sessions for this user.
 */
async function logout(ctx, userId = null) {
	// Clear all sessions for the given user id.
	if (userId != null) {
		AuthTokenInvalidateHelper.invalidateUser(userId);
		await Session.where('user_id', userId).delete({ require: false });
	}

	let ctxUserId = get(ctx, 'state.user.id', null);
	if ((userId == null) || (userId === ctxUserId)) {
		// Remove the session from the database.
		let sessionId = get(ctx, 'state.session.id', null);
		if (sessionId != null) {
			AuthTokenInvalidateHelper.invalidateSession(sessionId);
			await Session.where('id', sessionId).delete({ require: false });
		}

		// Override the header.
		ctx.set('x-set-auth-token', 'logout');

		// Override the cookie.
		let opts = {
			overwrite: true,
			httpOnly: true,
			maxAge: 0,
		};
		ctx.cookies.set('token', 'logout', opts);
	}
}

async function validateToken(ctx, token) {
	// Token format:
	// t: 'a', // Type: access token.
	// s: session.id, // Session id.
	// k: key, // Secret session key.
	// u: user_id, // User id.
	// r: roles, // User's roles.
	// c: Date.now(), // Created at.

	let decoded = jwt.decode(token);
	if (decoded == null) {
		throw new Error('Token invalid. Could not be decoded.');
	}
	if (decoded.t !== 'a') {
		throw new Error('Invalid token type. Access token is required.');
	}
	if (decoded.c > Date.now()) {
		throw new Error('Invalid token created at timestamp. Token was created in the future.');
	}

	try {
		// Validate token signature.
		// If token fails validation it will throw an error.
		decoded = rollingJWTVerify(token);
		return decoded;
	} catch (error) {
		if ((error.name !== 'TokenExpiredError') && !((error.name === 'JsonWebTokenError') && (error.message === 'invalid signature'))) {
			throw error;
		}

		// Check if valid session in the database.
		let session = await Session.where('id', decoded.s).where('user_id', decoded.u).isValid().first();
		if (session == null) {
			throw new Error('No valid session found in the database.');
		}

		// Verify secret session key with bcrypt.
		let hash = session.get('key');
		if (!(await bcrypt.compare(decoded.k, hash))) {
			throw new Error('Secret session key incorrect.');
		}

		// Create a new access token.
		session = session.toJSON();
		let tokenData = await createAndSetAccessToken(ctx, session, decoded.k);
		return tokenData;
	}

	// This should never happen.
	// return null;
}

async function checkApiKey(ctx) {
	try {
		if (ctx.headers['x-api-key'] == null) return null;
		let keyObj = await ApiKeyDAO.check(ctx.headers['x-api-key']);
		if (keyObj == null) return null;
		if (keyObj.user_id == null) return null;
		let decoded = await getUserData(ctx, keyObj.user_id);
		return decoded;
	} catch (error) {
		return null;
	}
}

/**
 * Get and verify auth token.
 *
 * @param {KoaContext} ctx
 */
async function getToken(ctx) {
	// Try to find the JWT token.
	let token = null;

	// Check for the API key.
	let decoded = await checkApiKey(ctx);
	if (decoded != null) return decoded;

	// First try to get the session token from the authorization header.
	if (ctx.headers.authorization != null) {
		let tokens = ctx.headers.authorization.split(' ');
		if (tokens.length >= 2) {
			token = tokens[1];
		}
	}

	// Try to get the session key from the cookie.
	if (USE_COOKIES && (token == null)) {
		token = ctx.cookies.get('token');
	}

	// If there is no token we can't do anything.
	if (!isString(token)) {
		return null;
	}

	// Validate token and return decoded token data.
	try {
		decoded = await validateToken(ctx, token);
		return decoded;
	} catch (error) {
		return null;
	}
}

/**
 * Roles cache.
 */
let rolesCache = new Map();

/**
 * Resolve roles from list of role ids.
 *
 * @param {integer[]} role_ids List of role ids.
 *
 * @returns {string[]} List of role names.
 */
function resolveRoles(role_ids) {
	return role_ids.map(id => rolesCache.get(id).name);
}

/**
 * Reloads the list of roles.
 */
async function reloadRolesCache() {
	// Get all roles.
	let roles = await Role.select(['id', 'name']).get();
	roles = roles.toJSON();

	// Clear the previous cache.
	rolesCache = new Map();

	// Create role names cache.
	for (let role of roles) {
		rolesCache.set(role.id, role);
	}
}

/**
 * Init auth middleware.
 * Just calls the reloadRolesCache function.
 */
async function init() {
	await reloadRolesCache();
}

/**
 * Function that attaches the logged in user to the context.
 *
 * @param {KoaContext} ctx
 * @param {object} token
 */
function setAuthUser(ctx, token) {
	ctx.state = ctx.state || {};

	// Create the user object and attach the user the context state.
	let user = decodeUserData(token);
	ctx.state.user = user;

	// Attach the session to the context state.
	ctx.state.session = {
		id: token.s || null,
		key: token.k || null,
	};
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	init,

	checkCredentials,
	login,
	logout,
	getToken,
	setAuthUser,
	getUserData,
};
