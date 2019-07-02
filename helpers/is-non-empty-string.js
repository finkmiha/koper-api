'use strict';

const isString = require('lodash/isString');

function isNonEmptyString(str) {
	if (!isString(str)) return false;
	return str.trim().length > 0;
}

module.exports = isNonEmptyString;
