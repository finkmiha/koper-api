"use strict";

const Log = require("unklogger");
const cheerio = require("cheerio");
const axios = require("axios");
const url = require("url");

const Location = require("../models/location");

/**
 * Scrape slovenian climbing sites.
 *
 */
async function scrape() {
	// Scrape.
	let link = "http://www.plezanje.net/climbing/db/cragIntro.asp?cc=SI&type=C&ord=n";
	let data = null;
	try {
        let response = await axios.get(link);
		data = response.data;
		Log.info("Climbing sites", "Scraping slovenia climbing sites.");
	} catch (error) {
		Log.error("Climbing sites", "Failed to scrape url " + link);
		throw error;
	}

	let $ = cheerio.load(data);
	let locations = Location.collection();
    let tableRows = $("table.fmtTable.active.striped.expandable tr").get();

	if (tableRows.length === 0) {
		throw new Error("No climbing sites found.");
	}

	for (let tableRow of tableRows) {
		let href = $(tableRow).find("td a").attr("href");
		let location = $(tableRow).find("td a").text().trim();
		let lcount = await Location.where("name", location).count();

		let location_link = null;

        if (typeof href !== "undefined") {
			location_link = url.resolve(link, href) + "&p_ord=n";
		}
		
		if (location !== "" && lcount == 0) {    
			// TODO: write script for region calculation (set to Slovenia for now).
    		locations.add({name: location, region_id: 6, source_url: location_link});
        }
	}
	if (locations.models.length > 0) {
		await locations.insert();
	}
	
	Log.success("Climbing sites", "Finished scraping climbing site.");
}

scrape();


/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	scrape,
};