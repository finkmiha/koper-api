"use strict";

const Log = require("unklogger");
const cheerio = require("cheerio");
const axios = require("axios");
const url = require("url");

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
    let links = [];
    let items = $("table.fmtTable.active.striped.expandable tr").get();

	if (items.length === 0) {
		response.error = "No climbing sites found.";
		return response;
	}

	for (let item of items) {
		let href = $(item).find("td a").attr("href");

        if (typeof href !== "undefined") {
            links.push(url.resolve(link, href));
        }
	}
	
	
	Log.success("Climbing sites", "Finished scraping slovenia climbing sites.");
	for (let link of links) {
		scrapeClimbingSite(link)
	}

}
scrape();

/**
 * Scrape slovenian climbing sites.
 *
 */
async function scrapeClimbingSite(link) {
	let data = null;
	try {
        let response = await axios.get(link);
		data = response.data;
		Log.info("Climbing sites", "Scraping slovenia climbing sites.");
	} catch (error) {
		Log.error("Climbing sites", "Failed to scrape url " + link);
		throw error;
	}

	// TODO: Scrape climbing site


	// TODO: Save site data to database
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	scrape,
};