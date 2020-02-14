'use strict';

const Joi = require('../helpers/joi-ext');

const WorkType = require('../models/work-type');

/**
 * Returns a list of all work types.
 *
 */
async function index(ctx, next) {
	let wt = await WorkType.get();
	ctx.body = wt;
}

/**
 * Add a new work type.
 *
 * @param {string} type Work type.
 */
async function store(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		type: Joi.string().required(),
	}));
	// Create the project.
	let wt = new WorkType({
		type: body.type,
	});

	// Save the new project.
	await wt.save();
	ctx.body = `Work type ${body.type} saved.`;
}

/**
 * Update work type by id.
 *
 * @param {integer} id Project id.
 * @param {string} [type] Work type.
 */
async function update(ctx, next) {
	let id = parseInt(ctx.params.id);
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		type: Joi.string().default(null),
	}));
	let wt = await WorkType.select(['id', 'type']).where('id', id).first();

	// Check if the project was found.
	ctx.assert(wt, 400, ctx.i18n.__(`Work type with id ${id} not found.`));

	// Update the project.
	if (body.type !== null) wt.set('type', body.type);

	let type = wt.toJSON().type;
	// Save the new project.
	await wt.save();
	ctx.body = `Work type ${type} updated.`;
}

/**
 * Delete work type by id.
 *
 * @param {integer} id Project id.
 */
async function destroy(ctx, next) {
	let id = parseInt(ctx.params.id);
	let wt = await WorkType.select(['id', 'type']).where('id', id).first();

	// Check if the project was found.
	ctx.assert(wt, 400, ctx.i18n.__(`Work type with id ${id} not found.`));

	let type = wt.toJSON().type;

	// Soft delete the user.
	await wt.delete();
	ctx.body = `Work type ${type} deleted.`;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	index,
	store,
	update,
	destroy,
};
