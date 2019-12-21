"use strict";

const Log = require("unklogger");
const cheerio = require("cheerio");
const axios = require("axios");
const url = require("url");

const Location = require("../models/location");
const Route = require("../models/route");

/**
 * Scrape slovenian climbing locations.
 *
 */
async function scrape() {
    let locations = await Location.select(["id", "name", "source_url"]).get();
    locations = locations.toJSON();

    for (let location of locations) {
        await scrapeLocation(location);
    }

    Log.success("Climbing locations", "Finished scraping all slovenian climbing locations.");
}

async function scrapeLocation(location) {
    let data = null;
	try {
        // http://www.plezanje.net/climbing/db/showCrag.asp?crag=582&p_ord=n
        let response = await axios.get(location.source_url);
        // let response = await axios.get("http://www.plezanje.net/climbing/db/showCrag.asp?crag=582&p_ord=n");
		data = response.data;
		Log.info("Climbing site", "Scraping climbing site " + location.name);
	} catch (error) {
		Log.error("Climbing site", "Failed to scrape url " + location.source_url);
		throw error;
	}

    let $ = cheerio.load(data);
    
    let routes = Route.collection();
    let tableRows = $("table#routeTable tbody tr").get();

	if (tableRows.length === 0) {
        Log.error("Climbing location", "No routes found at this location.");
	}

	for (let tableRow of tableRows) {
        let route = {};
        let href = $(tableRow).children().first().find("a").attr("href") || null;

        if (typeof href !== "undefined") {
			route.source_url = url.resolve(location.source_url, href);
		}

        route.name = $(tableRow).children().first().text().trim() || null;
        route.difficulty = $(tableRow).find("td.grade").text().trim() || null;
        if (route.difficulty == null) route.difficulty = $(tableRow).find("td p").text().trim() || null;

        let length = $(tableRow).find("td.right").text().trim() || null;
        if (length != null) {
            length = Number(length.split(" ")[0]);
            route.length = length;
        }
        

        route.sector = $(tableRow).find("td.formCellRpad").text().trim() || null;
        route.first_ascent = $(tableRow).find("td:nth-child(6)").text().trim() || null;
        if (route.first_ascent != null && route.first_ascent.includes("[")) {
            route.first_ascent = null;
        } 
        route.location_id = location.id;

        let rcount = await Route.where("name", route.name).andWhere("location_id", location.id).count();
        
		if (rcount == 0) {
    		routes.add(route);
        }
	}
	if (routes.models.length > 0) {
		await routes.insert();
    }

    Log.success("Location routes", "Finished scraping routes for " + location.name);
	
}

scrape();

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	scrape,
};