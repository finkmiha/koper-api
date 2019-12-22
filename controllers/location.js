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

	ctx.body = { locations };
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

    // Add Difficulty level
    for(var i = 0; i<locationRoutes.length; i++){
    let difficulty_level_indetifier = locationRoutes[i].difficulty.split('(')[0].trim();
    var difficulty_level = aDifficulties.indexOf(difficulty_level_indetifier);
    locationRoutes[i]['difficulty_level'] = difficulty_level;
    }
    // Add Difficulty level END

    // Add Difficulty Range
    let aDifficultyLevels = locationRoutes.map(rnd_number => rnd_number.difficulty_level);
    let minDifficulty = aDifficulties[Math.min(...aDifficultyLevels)];
    let maxDifficulty = aDifficulties[Math.max(...aDifficultyLevels)];
    // Add Routes Length
    let routesLength = locationRoutes.length

    location = Object.assign(
        location, 
        {number_of_routes:routesLength}, 
        {min_difficulty:minDifficulty}, 
        {max_difficulty:maxDifficulty}, 
        {routes: locationRoutes});
    
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


let aDifficulties = [
"2",
"3",
"4a",
"4a+",
"4a+/b",
"4a/a+",
"4b",
"4b+",
"4b+/c",
"4b/b+",
"4c",
"4c+",
"4c+/5a",
"4c/c+",
"5a",
"5a+",
"5a+/b",
"5a,A0",
"5a/a+",
"5b",
"5b+",
"5b+/c",
"5b,A2",
"5b/b+",
"5c",
"5c+",
"5c+/6a",
"5c/c+",
"6a",
"6a+",
"6a+/b",
"6a,A2",
"6a/a+",
"6b",
"6b+",
"6b+/c",
"6b/b+",
"6c",
"6c+",
"6c+/7a",
"6c/c+",
"7a",
"7a+",
"7a+/b",
"7a/a+",
"7b",
"7b+",
"7b+/c",
"7b/b+",
"7c",
"7c+",
"7c+/8a",
"7c/c+",
"8a",
"8a+",
"8a+/b",
"8a/a+",
"8b",
"8b+",
"8b+/c",
"8b/b+",
"8c",
"8c+",
"8c+/9a",
"8c/c+",
"9a",
"9a+/b",
"9a/a+",
]