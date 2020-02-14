'use strict';

const Joi = require('../helpers/joi-ext');
const moment = require('moment');

const Work = require('../models/work');
const UserDAO = require('../dao/user');

/**
 * Get daily hours done.
 *
 * @param {string} day Day of work.
 */
async function dailyWork(ctx, next) {
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		day: Joi.date().required(),
	}));

	let day = moment.utc(body.day).format('YYYY-MM-DD HH:mm:ss');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let dailyWork = await Work.where('day', day).where('user_id', user.id).first();
	dailyWork = dailyWork.toJSON();
	console.log(dailyWork);

	// Check if the project was found.
	ctx.assert(dailyWork, 400, ctx.i18n.__(`Work for user ${user.id} on ${day} not found.`));

	ctx.body = `Work done.`;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	dailyWork,
};
