'use strict';

const Joi = require('../helpers/joi-ext');

const Project = require('../models/project');

/**
 * Returns a list of all projects.
 *
 */
async function index(ctx, next) {
	let projects = await Project.get();
	ctx.body = projects;
}

/**
 * Returns a list of all projects.
 *
 * @param {string} name Project name.
 * @param {string} tag Project tag can be between 1 and 10 characters.
 */
async function store(ctx, next) {
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		name: Joi.string().required(),
		tag: Joi.string().min(1).max(10).required(),
	}));
	// Create the project.
	let project = new Project({
		name: body.name,
		tag: body.tag.toUpperCase(),
	});

	// Save the new project.
	await project.save();
	ctx.body = `Project ${body.name} - ${body.tag} saved.`;
}

/**
 * Update project by id.
 *
 * @param {integer} id Project id.
 * @param {string} [name] Project name.
 * @param {string} [tag] Project tag can be between 1 and 10 characters.
 */
async function update(ctx, next) {
	let id = parseInt(ctx.params.id);
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		name: Joi.string().default(null),
		tag: Joi.string().min(1).max(10).default(null),
	}));
	let project = await Project.select(['id', 'name', 'tag']).where('id', id).first();

	// Check if the project was found.
	ctx.assert(project, 400, ctx.i18n.__(`Project with id ${id} not found.`));

	// Update the project.
	if (body.name !== null) project.set('name', body.name);
	if (body.tag !== null) {
		let tag = body.tag.toUpperCase();
		project.set('tag', tag);
	}

	let name = project.toJSON().name;
	let tag = project.toJSON().tag;
	// Save the new project.
	await project.save();
	ctx.body = `Project ${name} - ${tag} updated.`;
}

/**
 * Delete project by id.
 *
 * @param {integer} id Project id.
 */
async function destroy(ctx, next) {
	let id = parseInt(ctx.params.id);
	let project = await Project.select(['id', 'name', 'tag']).where('id', id).first();

	// Check if the project was found.
	ctx.assert(project, 400, ctx.i18n.__(`Project with id ${id} not found.`));

	let name = project.toJSON().name;
	let tag = project.toJSON().tag;

	// Soft delete the user.
	await project.delete();
	ctx.body = `Project ${name} - ${tag} deleted.`;
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
