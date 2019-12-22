'use strict';

const Joi = require('../helpers/joi-ext');

const Route = require('../models/route');

const Location = require('../models/location');


/**
 * Get route by id.
 * 
 * @param {integer} id Route id.
 */
async function getRoute(ctx, next) {

    let id = parseInt(ctx.params.id);
    let route = await Route.where("id", id).first();
    route = route.toJSON();

    let location = await Location.where("id", route.location_id).first();

    location = location.toJSON();
    let location_name = location.name;

    ctx.assert(route, 400, `Route with id ${id} doesn't exist.`);

    route = Object.assign(route, {location_name});

	ctx.body = route;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
    getRoute,
};
