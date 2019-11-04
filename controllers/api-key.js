'use strict';

const Joi = require('../helpers/joi-ext');
const ApiKeyDAO = require('../dao/api-key');

/**
 * List all API keys.
 */
async function index(ctx, next) {
	ctx.body = await ApiKeyDAO.index(ctx);
}

/**
 * Create a new API key.
 *
 * @param {string} name
 * @param {boolean} [enabled=true]
 * @param {number|string} [expires_at] DateTime string in UTC parsable by moment.js or UNIX seconds since epoch.
 * @param {string} [description]
 */
async function store(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		name: Joi.string().required(),
		enabled: Joi.boolean().default(true),
		expires_at: Joi.moment().allow(null).default(null),
		description: Joi.string().allow('').allow(null).default(''),
	}));
	ctx.body = await ApiKeyDAO.store(ctx, body);
}

/**
 * Update an API key by id.
 *
 * @param {integer} id API key id.
 * @param {boolean} [enabled]
 * @param {number|string} [expires_at] DateTime string in UTC parsable by moment.js or UNIX seconds since epoch.
 * @param {string} [description]
 */
async function update(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		enabled: Joi.boolean().allow(null).default(null),
		expires_at: Joi.moment().allow(null),
		description: Joi.string().allow('').allow(null).default(null),
	}));
	let id = parseInt(ctx.params.id);
	ctx.body = await ApiKeyDAO.update(ctx, id, body);
}

/**
 * Delete an API key by id.
 *
 * @param {integer} id API key id.
 */
async function destroy(ctx, next) {
	let id = parseInt(ctx.params.id);
	await ApiKeyDAO.destroy(ctx, id);
	ctx.body = { message: 'API key successfully deleted.' };
}

module.exports = {
	index,
	store,
	update,
	destroy,
};
