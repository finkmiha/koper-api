'use strict';

const Joi = require('../helpers/joi-ext');

const Route = require('../models/route');


/**
 * Get route by id.
 * 
 * @param {integer} id Route id.
 */
async function getRoute(ctx, next) {

    let id = parseInt(ctx.params.id);
    let route = await Route.where("id", id).first();

	ctx.body = route;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
    getRoute,
};
