'use strict';

const moment = require('moment');

const isString = require('lodash/isString');
const isDate = require('lodash/isDate');
const get = require('lodash/get');
const isInteger = require('lodash/isInteger');
const isArray = require('lodash/isArray');

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
			// TODO: fix date formatting on FE
			// json[key] = date.format();
		}

		return json;
	};

	modelExt.none = function() {
		// TODO: maybe get the models id attribute from model settings
		this.where('id', '<', 0);
		this.where('id', '>', 0);
		return this;
	};
	modelExt.whereFalse = modelExt.none;

	modelExt.isOwnerScope = function(userId, attr = 'user_id') {
		if (!isInteger(userId) && !isArray(userId)) {
			userId = get(userId, 'state.user.id', null);
		}
		if (isInteger(userId)) {
			this.where(attr, userId);
		} else if (isArray(userId)) {
			this.whereIn(attr, userId);
		} else {
			// TODO: maybe get the models id attribute from model settings
			this.where('id', '<', 0);
			this.where('id', '>', 0);
		}
		return this;
	};

	modelExt.filterQuery = function(queryStr, attrs) {
		if (attrs == null) return this;
		if (!isArray(attrs)) attrs = [attrs];
		if (attrs.length < 1) return this;

		// Tokenize query string.
		let qTokens = queryStr.toLowerCase().split(/\W+/ug);
		qTokens = qTokens.filter(token => (token != null) && (token.length > 0));
		if (qTokens.length < 1) return this;

		// eslint-disable-next-line prefer-arrow-callback
		this.where(wq => {
			for (let attr of attrs) {
				for (let token of qTokens) {
					wq.orWhereLike(attr, `${token}%`);
					wq.orWhereLike(attr, `% ${token}%`);
				}
			}
		});

		return this;
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
