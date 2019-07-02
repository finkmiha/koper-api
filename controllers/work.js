'use strict';

const Joi = require('../helpers/joi-ext');
const moment = require('moment');

const Work = require('../models/work');
const UserDAO = require('../dao/user');

/**
 * Returns all user work done.
 *
 */
async function showWork(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let work = await Work.where('user_id', user.id).get();

	// Check if the project was found.
	ctx.assert(work, 400, ctx.i18n.__(`Work for user with id ${user.id} not found.`));
	ctx.body = work;
}

/**
 * Store new work interval.
 *
 * @param {integer} project_id Project id.
 * @param {integer} type_id Work type id.
 * @param {string} start Work interval start.
 * @param {string} [end] Work interval end.
 * @param {string} [description] Work description.
 */
async function storeWork(ctx, next) {
	let now = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		project_id: Joi.number().integer().required(),
		type_id: Joi.number().integer().required(),
		start: Joi.date().required(),
		end: Joi.date().default(now),
		description: Joi.string(),
	}));

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let start = moment.utc(body.start).format('YYYY-MM-DD HH:mm:ss');
	let end = moment.utc(body.end).format('YYYY-MM-DD HH:mm:ss');

	let work = new Work({
		user_id: user.id,
		project_id: body.project_id,
		type_id: body.type_id,
		start: start,
		end: end,
		day: moment.utc(body.start).format('YYYY-MM-DD'),
		time_elapsed: moment(end).diff(start, 'seconds'),
		description: body.description,
	});
	await work.save();
	ctx.body = 'Work saved.';
}

/**
 * Update work interval.
 *
 * @param {integer} id Work id.
 * @param {integer} [project_id] Project id.
 * @param {integer} [type_id] Work type id.
 * @param {string} [start] Work interval start.
 * @param {string} [end] Work interval end.
 * @param {string} [description] Work description.
 */
async function updateWork(ctx, next) {
	let id = parseInt(ctx.params.id);
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		project_id: Joi.number().integer().default(null),
		type_id: Joi.number().integer().default(null),
		start: Joi.date().default(null),
		end: Joi.date().default(null),
		description: Joi.string().default(null),
	}));

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let work = await Work.where('id', id).where('user_id', user.id).first();

	// Check if the project was found.
	ctx.assert(work, 400, ctx.i18n.__(`Work with id ${id} for user ${user.id} not found.`));

	// Update the project.
	if (body.project_id !== null) work.set('project_id', body.project_id);
	if (body.type_id !== null) work.set('type_id', body.type_id);
	if (body.start !== null) {
		let start = moment.utc(body.start).format('YYYY-MM-DD HH:mm:ss');
		let day = moment.utc(body.start).format('YYYY-MM-DD')
		work.set('start', start);
		work.set('day', day);
	}
	if (body.end !== null) {
		let end = moment.utc(body.end).format('YYYY-MM-DD HH:mm:ss');
		work.set('end', end);
	}
	if (body.description !== null) work.set('description', body.description);

	// Update elapsed time before work save.
	if (body.start !== null || body.end !== null) {
		let start = moment.utc(body.start).format('YYYY-MM-DD HH:mm:ss');
		let end = moment.utc(body.end).format('YYYY-MM-DD HH:mm:ss');
		let dif = moment(end).diff(start, 'seconds');
		work.set('time_elapsed', dif);
	}
	// Save the new project.
	await work.save();
	ctx.body = `Work with id ${id} updated.`;
}

/**
 * Delete work interval.
 *
 * @param {integer} id Work id.
 */
async function deleteWork(ctx, next) {
	let id = parseInt(ctx.params.id);

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let work = await Work.where('id', id).where('user_id', user.id).first();

	// Check if the project was found.
	ctx.assert(work, 400, ctx.i18n.__(`Work with id ${id} for user ${user.id} not found.`));

	await work.delete();
	ctx.body = `Work with id ${id} for user ${user.id} deleted.`;
}

/**
 * Get daily work done.
 *
 * @param {string} day Day of work.
 */
async function dailyWork(ctx, next) {
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		day: Joi.date().required(),
	}));

	let day = moment.utc(body.day).format('YYYY-MM-DD');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let dailyWork = await Work.where('day', day).where('user_id', user.id).get();

	let time_elapsed = 0;

	for (let dw of dailyWork.models) {
		time_elapsed = time_elapsed + dw.get('time_elapsed');
	}

	// Check if the project was found.
	ctx.assert(dailyWork, 400, ctx.i18n.__(`Work for user ${user.id} on ${day} not found.`));

	ctx.body = `Daily work: ${time_elapsed} seconds.`;
}

/**
 * Get monthly work.
 *
 * @param {integer} month Day of work.
 */
async function monthlyWork(ctx, next) {
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		month: Joi.integer().required(),
	}));

	let day = moment.utc(body.day).format('YYYY-MM-DD');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let dailyWork = await Work.where('day', day).where('user_id', user.id).get();

	let time_elapsed = 0;

	for (let dw of dailyWork.models) {
		time_elapsed = time_elapsed + dw.get('time_elapsed');
	}

	// Check if the project was found.
	ctx.assert(dailyWork, 400, ctx.i18n.__(`Work for user ${user.id} on ${day} not found.`));

	ctx.body = `Daily work: ${time_elapsed} seconds.`;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	showWork,
	storeWork,
	updateWork,
	deleteWork,
	dailyWork,
};
