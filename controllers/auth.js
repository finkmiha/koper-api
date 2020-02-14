'use strict';

const Joi = require('../helpers/joi-ext');
const AuthHelper = require('../helpers/auth');

const User = require('../models/user');

/**
 * Login.
 *
 * @param {string} email
 * @param {string} password
 */
async function login(ctx, next) {
	// Validate input.
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		email: Joi.string().max(255).required(),
		password: Joi.string().allow('').required(),
	}));

	// Check credentials.
	let user = await AuthHelper.checkCredentials(ctx, User.where('email', body.email), body.password);

	// Login - create a new session.
	await AuthHelper.login(ctx, user.get('id'));

	ctx.body = { message: ctx.i18n.__('Login successful.') };
}

/**
 * Logout.
 */
async function logout(ctx, next) {
	await AuthHelper.logout(ctx); // Logout - destroy the current session.
	ctx.body = { message: ctx.i18n.__('Logout successful.') };
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	login,
	logout,
};
