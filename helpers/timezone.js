'use strict';

// Another interesting source: https://github.com/dmfilipenko/timezones.json/blob/master/timezones.json

const moment = require('moment-timezone');

let TIMEZONES = [];
let TIMEZONE_VALUES = [];
let TIMEZONE_MAP = new Map();

function reload() {
	try {
		TIMEZONES = moment.tz.names().map(tzName => {
			return {
				value: tzName,
				label: `(UTC${moment().tz(tzName).format('Z')}) ${tzName.replace(/\//g, ', ').replace(/_/g, ' ')}`,
			};
		});
		TIMEZONE_VALUES = TIMEZONES.map(tz => tz.value);
		TIMEZONE_MAP = new Map();
		for (let tz of TIMEZONES) TIMEZONE_MAP.set(tz.value, tz);
	} catch (error) { }
}
reload();
setInterval(reload, 15 * 60 * 1000);

function getTimezones() {
	return TIMEZONES;
}

function getTimezoneValues() {
	return TIMEZONE_VALUES;
}

function getTimezonesMap() {
	return TIMEZONE_MAP;
}

module.exports = {
	DEFAULT_TIMEZONE: 'Universal',
	getTimezones,
	getTimezoneValues,
	getTimezonesMap,
};
