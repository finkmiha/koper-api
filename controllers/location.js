'use strict';

const Joi = require('../helpers/joi-ext');

const Location = require('../models/location');
const Route = require('../models/route');

/**
 * Get List of locations.
 *
 */
async function index(ctx, next) {
    let locations = await Location.get();
    locations = locations.toJSON();

	ctx.body = locations;
}


/**
 * Get location by id.
 * 
 * @param {integer} id Location id.
 */
async function getLocation(ctx, next) {

    let id = parseInt(ctx.params.id);
    let location = await Location.where("id", id).first();
    ctx.assert(location, 400, `Location with id ${id} doesn't exist.`);
    location = location.toJSON();

    let locationRoutes = await Route.select(["id", "name", "difficulty", "length", "sector", "first_ascent"]).where("location_id", id).get();
    locationRoutes = locationRoutes.toJSON();

    delete location.created_at;
    delete location.updated_at;
    location = Object.assign(location, {routes: locationRoutes});
    

	ctx.body = location;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
    index,
    getLocation,
};
