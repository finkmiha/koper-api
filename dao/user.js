'use strict';

const moment = require('moment');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const QWE = require('../helpers/qwe');
const EmailHelper = require('../helpers/email');
// const LambdaHelper = require('../helpers/lambda');

const isArray = require('lodash/isArray');
const get = require('lodash/get');

const Role = require('../models/role');
const User = require('../models/user');
const Work = require('../models/work');
// const AddressDAO = require('../dao/address');

/**
 * Get user details.
 *
 * @param {KoaContext} ctx In this case context is just used for throwing errors and not for checking permissions.
 * @param {integer} userId
 * @param {boolean} [withAddress=false] Fetch the user's address.
 */
async function show(ctx, userId, withAddress = false) {
	// Get the user with the given id.
	let uquery = User.where('id', userId).with('roles');
	// if (withAddress) uquery.with('address');
	let user = await uquery.first();

	// Check if the user was found.
	ctx.assert(user, 400, ctx.i18n.__('User with id %(user_id)d not found.', { user_id: userId }));
	user = user.toJSON();

	// Format the user.
	user.is_me = (user.id === get(ctx, 'state.user.id', null));

	// Return the user.
	return user;
}

// /**
//  * Send verification email.
//  *
//  * @param {KoaContext} ctx In this case context is just used for throwing errors and not for checking permissions.
//  * @param {integer} userId
//  * @param {string} email User's email.
//  * @param {string} linkType Possible options are "dashboard" and "mobile".
//  */
async function sendVerificationEmail(ctx, userId, email) {
	// Find the user.
	let user = null;
	if (userId != null) {
		user = await User.select(['id', 'email', 'email_verified_at'])
			.where('id', userId).first();
		ctx.assert(user, 400, ctx.i18n.__('User with the given id not found.'));
	} else if (email != null) {
		user = await User.select(['id', 'email', 'email_verified_at'])
			.where('email', email).first();
		ctx.assert(user, 400, ctx.i18n.__('User with the given e-mail not found.'));
	} else {
		ctx.throw(400, ctx.i18n.__('User not found.'));
	}

	if (user.get('email_verified_at') != null) {
		ctx.throw(400, ctx.i18n.__('E-mail already verified.'));
	}

	// Build the verification token.
	user = user.toJSON();
	const expiresIn = 24 * 60 * 60; // 1 day in seconds.
	let token = jwt.sign({
		t: 'v', // token type ("v" = Verify)
		u: user.id, // users id
		c: Number(new Date()), // token createdAt timestamp
	}, process.env.JWT_SECRET, { expiresIn: expiresIn });

	// Build verify link.
	let actionUrl = `${process.env.CLIENT_BASE_URL}/api/verify/verify/${token}`;

	// Send the verify email.
	EmailHelper.sendEmail(ctx, 'verify', {
		email_address: user.email,
		action_url: actionUrl,
	});

	return { message: ctx.i18n.__('E-mail sent.') };
}

/**
 * Create a new user.
 *
 * @param {KoaContext} ctx In this case context is just used for throwing errors and not for checking permissions.
 * @param {object} data User's data.
 * @param {integer[]} [role_ids]
 * @param {boolean} [emailVerified=false] Set verified email flag to true.
 */
async function store(ctx, data, role_ids = [], emailVerified = false) {
	// Check for duplicate email.
	let emailCount = await User.where('email', data.email).count();
	ctx.assert(emailCount <= 0, 400, ctx.i18n.__('The username already exists. Please use a different username or login.'), { field: 'email' });

	// Check if roles exist.
	if (role_ids.length > 0) {
		role_ids = Array.from(new Set(role_ids));
		let roles = await Role.select(['id']).whereIn('id', role_ids).get();
		roles = new Set(roles.toJSON().map(r => r.id));
		for (let role_id of role_ids) {
			if (!roles.has(role_id)) ctx.throw(400, ctx.i18n.__('Role with id %(role_id)d not found.', { role_id: role_id }));
		}
	}

	// Create an address for the user.
	// let address = await AddressDAO.store(ctx, data.address);

	// Create the user.
	let user = new User({
		first_name: data.first_name,
		last_name: data.last_name,
		email: data.email,
		password: (data.password != null) ? await bcrypt.hash(data.password, 10) : null,
		email_verified_at: emailVerified ? moment.utc().format('YYYY-MM-DD HH:mm:ss') : null,
		type: data.type,
		// address_id: address.id,
	});

	// Save the new user.
	await user.save();
	let userId = user.get('id');

	// Attach the roles to the user.
	if (role_ids.length > 0) {
		try {
			await user.roles().attach(role_ids);
		} catch (e) { }

		// TODO: If user roles were chaned then we need to invalidate the JWT access token.
		// await ctx.state.sessions.invalidateUserAccessTokens(ctx, userId);
	}

	if (!emailVerified) {
		// TODO: Send different email depending if password was set or not.
		// Send the "set password"/"email verification"/"invitation" email. Don't await.
		await sendVerificationEmail(ctx, userId, null, data.app_type);
	}

	return user;
}
// store = QWE.lockify(store);

/**
 * Update an existing user.
 *
 * @param {KoaContext} ctx In this case context is just used for throwing errors and not for checking permissions.
 * @param {integer} userId
 * @param {object} data User's data.
 * @param {integer[]} [role_ids]
 */
async function update(ctx, userId, data, role_ids = null) {
	// Get the user with the given id.
	let user = await User.select(['id']).where('id', userId).first();

	// Check if the user was found.
	ctx.assert(user, 400, ctx.i18n.__('User with id %(user_id)d not found.', { user_id: userId }));

	// Check if roles exist.
	if (isArray(role_ids) && (role_ids.length > 0)) {
		role_ids = Array.from(new Set(role_ids));
		let roles = await Role.select(['id']).whereIn('id', role_ids).get();
		roles = new Set(roles.toJSON().map(r => r.id));
		for (let role_id of role_ids) {
			if (!roles.has(role_id)) ctx.throw(400, ctx.i18n.__('Role with id %(role_id)d not found.', { role_id: role_id }));
		}
	}

	// Update attributes on the user.
	let updateSNSTopic = false;
	// TODO: maybe send an email that the password was changed.
	if (data.password != null) user.set('password', await bcrypt.hash(data.password, 10));
	if (data.jwt_password_reset_counter != null) user.set('jwt_password_reset_counter', data.jwt_password_reset_counter);
	if (data.email_verified_at != null) user.set('email_verified_at', data.email_verified_at);

	if (data.first_name != null) user.set('first_name', data.first_name);
	if (data.last_name != null) user.set('last_name', data.last_name);
	if (data.backup_email != null) user.set('backup_email', data.backup_email);
	if (data.private_phone != null) user.set('private_phone', data.private_phone);
	if (data.work_phone != null) {
		user.set('work_phone', data.work_phone);
		if ((data.notify_phone == null) && (user.get('notify_phone') == null)) {
			updateSNSTopic = true;
			user.set('notify_phone', data.work_phone);
		}
	}
	if (data.profile_picture_url != null) user.set('profile_picture_url', data.profile_picture_url);

	if (data.is_sms_notify_enabled != null) user.set('is_sms_notify_enabled', data.is_sms_notify_enabled);
	if (data.notify_phone != null) {
		updateSNSTopic = true;
		user.set('notify_phone', data.notify_phone);
	}
	if (data.is_email_notify_enabled != null) user.set('is_email_notify_enabled', data.is_email_notify_enabled);
	if (data.notify_email != null) user.set('notify_email', data.notify_email);
	if (data.is_push_notify_enabled != null) user.set('is_push_notify_enabled', data.is_push_notify_enabled);

	// Save the changes.
	if (Object.keys(user.changed).length > 0) {
		await user.save();
	}

	// Update address.
	// if (data.address != null) {
	// 	await AddressDAO.update(ctx, addressId, data.address);
	// }

	// Update the user roles.
	if (isArray(role_ids)) {
		// Detach all previous roles.
		await user.roles().detach();
		// Attach new roles.
		if (role_ids.length > 0) {
			try {
				await user.roles().attach(role_ids);
			} catch (e) { }
		}

		// TODO: If user roles were chaned then we need to invalidate the JWT access token.
		// await ctx.state.sessions.invalidateUserAccessTokens(ctx, userId);
	}

	// if (updateSNSTopic) {
	// 	await LambdaHelper.invokeAsync({
	// 		FunctionName: 'upsert-user-sns-topic',
	// 		InvokeArgs: JSON.stringify({
	// 			user_id: userId,
	// 		}, null, 2),
	// 	}).promise();
	// }

	return user;
}

/**
 * Delete a user account.
 *
 * @param {KoaContext} ctx
 * @param {integer} userId
 */
async function destroy(ctx, userId) {
	// Get the user with the given id.
	let user = await User.select(['id']).where('id', userId).first();

	// Check if the user was found.
	ctx.assert(user, 400, ctx.i18n.__('User with id %(user_id)d not found.', { user_id: userId }));

	// Soft delete the user.
	await user.delete();
}

/**
 * Get user daily work.
 *
 * @param {KoaContext} ctx In this case context is just used for throwing errors and not for checking permissions.
 * @param {integer} userId
 * @param {string} day
 */
async function dailyWork(ctx, userId, day) {
	let dailyWork = await Work.where('day', day).where('user_id', userId).get();

	// Check if the project was found.
	// ctx.assert(dailyWork, 400, ctx.i18n.__(`Work for user ${userId} on ${day} not found.`));

	let time_elapsed = 0;
	for (let dw of dailyWork.models) {
		time_elapsed = time_elapsed + dw.get('time_elapsed');
	}

	// Return daily work done.
	return time_elapsed;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	show,
	store,
	update,
	destroy,

	dailyWork,
	sendVerificationEmail,
};
