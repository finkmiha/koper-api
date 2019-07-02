'use strict';

const AuthHelper = require('../helpers/auth');

const User = require('../models/user');

/**
 * Authorization middleware.
 * This function checks if the user is logged in by checking if a user session is present.
 * It also attaches the user to the context state.
 */
async function auth(ctx, next) {
	// Check if the auth token present and valid.
	let token = await AuthHelper.getToken(ctx);

	// Check if the user session is present.
	if (token == null) {
		ctx.throw(401, ctx.i18n.__('Not authorized. Please login.'));
	}

	try {
		// Set the user as authorized.
		AuthHelper.setAuthUser(ctx, token);
	} catch (err) {
		ctx.throw(401, ctx.i18n.__('Not authorized. Please login.'));
	}

	// Execute the route.
	if (next != null) await next();
}

/**
 * Authorization middleware.
 * This function automatically sets an auth user.
 * It attaches the user to the context state.
 * It also attaches the user's session to the context state.
 */
async function autoAuth(ctx, next) {
	// Get the admin user.
	let user = await User.select('id').where('email', 'admin@gmail.com')
		.withSelect('roles', ['id', 'name']).first();

	// Check if the user was found.
	ctx.assert(user, 500, ctx.i18n.__('User not found.'));
	user = user.toJSON();

	// Set the user as authorized.
	AuthHelper.setAuthUser(ctx, {
		u: user.id,
		r: user.roles.map(r => r.id),
	});

	// Execute the route.
	if (next != null) await next();
}

/**
 * Middleware that checks if user has any of the given roles.
 *
 * @param roleList (array of strings) Or-List of roles.
 */
function roles(roleList) {
	// If roleList not an array the encapsulate it into an array.
	if (roleList.constructor !== Array) {
		roleList = [roleList];
	}

	return async function(ctx, next) {
		// Check if the user is logged in.
		if (ctx.state.user == null) {
			ctx.throw(401, ctx.i18n.__('Not authorized. Please login.'));
		}

		// Check if user any of the roles in the list.
		let user = ctx.state.user;
		for (let roleName of roleList) {
			if (!user.roles.has(roleName)) {
				continue;
			}

			// Execute the route.
			if (next != null) await next();
			return;
		}

		// None of the roles matched.
		ctx.throw(403, ctx.i18n.__('Forbidden. You are missing the permission to perform this action.'));
	};
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	auth,
	autoAuth,
	roles,
};
