'use strict';

// https://github.com/hapijs/joi-date/blob/master/lib/index.js

const Moment = require('moment');
const isString = require('lodash/isString');
const isEmptyString = require('./isEmptyString');

function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports = (joi) => ({

	name: 'moment',

	base: joi.any(),

	language: {
		format: 'must be a string with one of the following formats {{format}}',
		moment: 'must be a string parsable by moment.js in UTC or UNIX seconds since epoch',
	},

	coerce(value, state, options) {
		if (value == null) return value;
		if (isEmptyString(value)) return null;
		if (value instanceof Date) {
			let date = Moment.utc(value);
			return date;
		}
		if (isNumeric(value)) {
			// TODO: could check that the object is not an array
			let date = Moment.utc(value.toString(), 'X');
			return date;
		}
		if (isString(value)) {
			if (this._flags.momentFormat) {
				let date = Moment.utc(value, this._flags.momentFormat, true);
				if (date.isValid()) return date;
				return this.createError('moment.format', { value, format: this._flags.momentFormat }, state, options);
			} else {
				let date = Moment.utc(value);
				if (date.isValid()) return date;
				return this.createError('moment.moment', { value, format: null }, state, options);
			}
		}
		if (this._flags.momentFormat) {
			return this.createError('moment.format', { value, format: this._flags.momentFormat }, state, options);
		} else {
			return this.createError('moment.moment', { value, format: null }, state, options);
		}
	},

	// eslint-disable-next-line consistent-return
	pre(value, state, options) {
		if (!Moment.isMoment(value)) {
			return this.createError('moment.moment', { value, format: null }, state, options);
		}
		return value;
	},

	rules: [
		{
			name: 'format',
			description(params) {
				return `Date should respect format ${params.format} or UNIX seconds since epoch`;
			},
			params: {
				format: joi.array().items(joi.any()).single().required(),
			},
			setup(params) {
				this._flags.momentFormat = params.format;
			},
			validate(params, value, state, options) {
				// No-op just to enable description
				return value;
			},
		},
	],
});
