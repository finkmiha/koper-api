"use strict";

const Region = require("../models/region");

const REGIONS = [
	{ name: "Slovenia"},
];

async function storeRegions() {
    // Insert roles.
    let regions = Region.collection();
    for (let region of REGIONS) regions.add(region);
    await regions.insert();
}

storeRegions();

