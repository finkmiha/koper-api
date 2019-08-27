'use strict';

const Joi = require('../helpers/joi-ext');
const AuthHelper = require('../helpers/auth');
// const FileHelper = require('../helpers/file');
const isNonEmptyString = require('../helpers/is-non-empty-string');

const Role = require('../models/role');
const User = require('../models/user');
const UserDAO = require('../dao/user');

/**
 * Get the logged in user.
 */
async function showMe(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	ctx.body = user;
}

/**
 * Get the logged in user.
 */
async function showMeData(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	ctx.body = user;
}

/**
 * Get the logged in user's account page info.
 */
async function showMeAccount(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	ctx.body = {
		user: user,
	};
}

/**
 * Check if a user with the given email already exists.
 *
 * @param {string} email
 */
async function showEmail(ctx, next) {
	let body = Joi.validate(ctx.query, Joi.object().keys({
		email: Joi.string().email().min(4).max(64).required().error(() => ctx.i18n.__('Please enter a valid email address.')),
	}));

	let count = await User.where('email', body.email).count();
	ctx.assert(count <= 0, 400, ctx.i18n.__('This email is alredy taken. Please use a different email or login.'), { field: 'email' });

	ctx.body = { message: ctx.i18n.__('Email is still free.') };
}

/**
 * Register a new user.
 *
 * @param {string} first_name
 * @param {string} last_name
 * @param {string} email
 * @param {string} password Please enter stronger password. Use at least 1 lowercase character and at least 1 number.
 * @param {string} type
 * @param {string} role Available roles: 'admin' or 'user'.
 *
 */
async function store(ctx, next) {
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		first_name: Joi.string().required(),
		last_name: Joi.string().required(),
		email: Joi.string().email().min(4).max(64).required().error(() => ctx.i18n.__('Please enter a valid email address.')),
		password: Joi.password().required(),
		role: Joi.string().valid(['admin', 'user']).default('user'),
		type: Joi.string().valid(['Employee', 'Student']).required(),
	}));

	// Get the user role.
	let roleIds = await Role.select(['id']).where('name', body.role).get();
	roleIds = roleIds.toJSON().map(r => r.id);

	let user = await UserDAO.store(ctx, body, roleIds);

	// Show the created user.
	ctx.body = await UserDAO.show(ctx, user.get('id'), true);
}

/**
 * Update the logged in user.
 *
 * @param {string} [first_name]
 * @param {string} [last_name]
 * @param {string} [type]
 * @param {string} [backup_email]
 * @param {string} [work_phone]
 * @param {string} [private_phone]
 *
 * @param {string} [old_password] If you want to change the password you must enter the old password.
 * @param {string} [password] Password must contain at least 1 uppercase, 1 lowercase, 1 numeric and 1 special character.
 *
 * @param {boolean} [is_sms_notify_enabled]
 * @param {string} [notify_phone]
 * @param {boolean} [is_email_notify_enabled]
 * @param {string} [notify_email]
 * @param {boolean} [is_push_notify_enabled]
 */
async function updateMe(ctx, next) {
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		first_name: Joi.string().allow('').allow(null).default(null),
		last_name: Joi.string().allow('').allow(null).default(null),
		type: Joi.string().allow(null).default(null),
		backup_email: Joi.string().allow('').allow(null).default(null),
		work_phone: Joi.string().allow('').allow(null).default(null),
		private_phone: Joi.string().allow('').allow(null).default(null),

		old_password: Joi.string().allow(null).default(null),
		password: Joi.password().allow(null).default(null),

		is_sms_notify_enabled: Joi.boolean().allow(null).default(null),
		notify_phone: Joi.string().allow('').allow(null).default(null),
		is_email_notify_enabled: Joi.boolean().allow(null).default(null),
		notify_email: Joi.string().allow('').allow(null).default(null),
		is_push_notify_enabled: Joi.boolean().allow(null).default(null),
	}));

	if (isNonEmptyString(body.backup_email)) {
		Joi.validate(body.backup_email, Joi.string().email().min(4).max(64).error(() => ctx.i18n.__('Please enter a valid backup email address.')));
	} else body.backup_email = null;
	if (isNonEmptyString(body.notify_email)) {
		Joi.validate(body.notify_email, Joi.string().email().min(4).max(64).error(() => ctx.i18n.__('Please enter a valid notification email address.')));
	} else body.notify_email = null;

	// Check old password.
	if (body.password != null) {
		try {
			await AuthHelper.checkCredentials(ctx, User.where('id', ctx.state.user.id), body.old_password);
		} catch (error) {
			ctx.throw(400, ctx.i18n.__('The old password is incorrect.'));
		}
	}

	let user = await UserDAO.update(ctx, ctx.state.user.id, body);

	// Show the created user.
	ctx.body = await UserDAO.show(ctx, user.get('id'), true);
}

// /**
//  * Upload profile picture.
//  *
//  * @param {file} file An image file in png or jpeg format.
//  */
// async function updateMeProfilePicture(ctx, next) {
// 	let profilePictureUrl = await FileHelper.uploadImage(ctx, 'profile_pictures', 'file');
// 	if (profilePictureUrl == null) {
// 		ctx.throw(400, ctx.i18n.__('Profile picture file parameter missing.'));
// 	}
// 	await UserDAO.update(ctx, ctx.state.user.id, { profile_picture_url: profilePictureUrl });
// 	ctx.body = { message: ctx.i18n.__('Profile picture successfully uploaded.') };
// }

/**
 * Delete the logged in user.
 */
async function destroyMe(ctx, next) {
	await UserDAO.destroy(ctx, ctx.state.user.id);

	// Logout the user that was deleted.
	await AuthHelper.logout(ctx, ctx.state.user.id);

	ctx.body = { message: ctx.i18n.__('Account successfully deleted.') };
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	showMe,
	showMeData,
	showMeAccount,
	showEmail,
	store,
	updateMe,
	destroyMe,
};
