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
 * Returns a list of all work projects.
 *
 */
async function getWorkProjects(ctx, next) {
	let projects = await Project.whereNotIn('name', ["Vacation", "Sick leave", "Extra hours"]).get();
	ctx.body = projects;
}

/**
 * Store project.
 *
 * @param {string} name Project name.
 * @param {string} tag Project tag can be between 1 and 10 characters.
 * @param {string} color Project color hex code.
 */
async function store(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		name: Joi.string().required(),
		tag: Joi.string().min(1).max(10).required(),
		color: Joi.string().required(),
	}));
	// Create the project.
	let project = new Project({
		name: body.name,
		tag: body.tag.toUpperCase(),
		color: body.color,
	});
	//Check for duplicate projects
	let count = await Project.where('name', body.name).count();
	ctx.assert(count <= 0, 400, ctx.i18n.__('A project with this name alredy exists.'), { field: 'name' });

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
 * @param {string} [color] Project color hex code.
 */
async function update(ctx, next) {
	let id = parseInt(ctx.params.id);
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		name: Joi.string().default(null),
		tag: Joi.string().min(1).max(10).default(null),
		color: Joi.string().default(null),
	}));
	let project = await Project.select(['id', 'name', 'tag', 'color']).where('id', id).first();

	// Check if the project was found.
	ctx.assert(project, 400, ctx.i18n.__(`Project with id ${id} not found.`));

	// Update the project.
	if (body.name !== null) project.set('name', body.name);
	if (body.tag !== null) {
		let tag = body.tag.toUpperCase();
		project.set('tag', tag);
	}
	if (body.color !== null) project.set('color', body.color);

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
	getWorkProjects,
};
