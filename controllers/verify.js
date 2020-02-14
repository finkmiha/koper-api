'use strict';

const moment = require('moment');
const jwt = require('jsonwebtoken');
const Joi = require('../helpers/joi-ext');

const User = require('../models/user');
const UserDAO = require('../dao/user');
const AuthHelper = require('../helpers/auth');

/**
 * Resend verification e-mail.
 *
 * @param {string} email User's email.
 */
async function sendVerifyEmail(ctx, next) {
	// Validate input.
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		email: Joi.string().email().required(),
	}));

	ctx.body = await UserDAO.sendVerificationEmail(ctx, null, body.email);
}

/**
 * Helper function to verify the verification token.
 *
 * @param {KoaContext} ctx
 * @param {string} token
 */
async function verifyTokenHelper(ctx, token) {
	// Try to verify token with valid secret.
	let decoded = null;
	try {
		decoded = jwt.verify(token, process.env.JWT_SECRET);
	} catch (error) {
		if (error.name === 'TokenExpiredError') ctx.throw(400, ctx.i18n.__('JWT token has expired.'));
		else if (error.name === 'JsonWebTokenError') ctx.throw(400, ctx.i18n.__('JWT token is invalid.'));
		else throw error;
	}

	// Check if create date valid.
	let ctime = Number(new Date());
	if (decoded.c > ctime) {
		ctx.throw(400, ctx.i18n.__('Token create date is invalid.'));
	}

	// Check token type.
	if (decoded.t !== 'v') {
		ctx.throw(400, ctx.i18n.__('Token type is invalid.'));
	}

	// Find the user with the given id.
	let user = await User.select(['id', 'email_verified_at']).where('id', decoded.u).first();
	ctx.assert(user, 400, ctx.i18n.__('User with the given id not found.'));

	// Check if the token was already used.
	if (user.get('email_verified_at') != null) {
		ctx.throw(400, ctx.i18n.__('E-mail already verified.'));
	}

	return decoded;
}

/**
 * Verify verification token.
 *
 * @param {string} token
 */
async function verifyToken(ctx, next) {
	// Validate input.
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		token: Joi.string().required(),
	}));

	// Verify token.
	await verifyTokenHelper(ctx, body.token);

	ctx.body = { message: ctx.i18n.__('Token is valid.') };
}

/**
 * Verify user's email.
 *
 * @param {string} token
 */
async function verify(ctx, next) {
	// Validate input.
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		token: Joi.string().required(),
	}));

	// Verify token.
	let decoded = await verifyTokenHelper(ctx, body.token);

	// Set the user's password.
	await UserDAO.update(ctx, decoded.u, {
		email_verified_at: moment.utc().format('YYYY-MM-DD HH:mm:ss'),
	});

	// Log the user in so that the user can be forwarded to complete profile page.
	await AuthHelper.login(ctx, decoded.u);

	ctx.body = { message: ctx.i18n.__('E-mail was successfully verified.') };
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	sendVerifyEmail,
	verifyToken,
	verify,
};
