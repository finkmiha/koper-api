'use strict';

const moment = require('moment');

const isString = require('lodash/isString');
const isDate = require('lodash/isDate');

// Eloquent plugin -
// Adds the functionality for translations.
// -----
module.exports = function(Bookshelf) {
	const modelProto = Bookshelf.Model.prototype;
	const knex = Bookshelf.knex;

	// Extract all methods that will be overridden.
	const modelToJSON = modelProto.toJSON;

	// Build the extension object.
	let modelExt = {};

	// ---------------------------------------------------------------------------
	// ------ To JSON translate --------------------------------------------------
	// ---------------------------------------------------------------------------

	modelExt.toJSON = function(...args) {
		let json = modelToJSON.apply(this, args);

		// Check all object properties and cast timestamps to unix integer.
		for (let key in json) {
			if (!json.hasOwnProperty(key)) continue;
			if (!key.endsWith('_at') && !key.endsWith('At')) continue;
			let val = json[key];
			if (!isString(val) && !isDate(val)) continue;
			let date = moment.utc(val);
			if (!date.isValid()) continue;
			json[key] = date.unix();
		}

		return json;
	};

	// ---------------------------------------------------------------------------
	// ------ Static Methods -----------------------------------------------------
	// ---------------------------------------------------------------------------

	let staticModelExt = {};

	// For each extension method we need a way to call it statically.
	for (let method in modelExt) {
		if (!modelExt.hasOwnProperty(method)) continue;
		if (method === 'delete') continue;
		staticModelExt[method] = function(...args) {
			return this.forge()[method](...args);
		};
	}

	// Extend the model.
	Bookshelf.Model = Bookshelf.Model.extend(modelExt, staticModelExt);
};
