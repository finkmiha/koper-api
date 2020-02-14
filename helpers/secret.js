'use strict';

const isString = require('lodash/isString');
const crypto = require('crypto');

// Function that replaces characters.
// http://locutus.io/php/strings/strtr/
function strtr(_this, trFrom, trTo) {
	//   Example 2: strtr('äaabaåccasdeöoo', 'äåö', 'aao')
	//   returns 2: 'aaabaaccasdeooo'
	//   example 3: strtr('ääääääää', 'ä', 'a')
	//   returns 3: 'aaaaaaaa'
	//   example 4: strtr('http', 'pthxyz', 'xyzpth')
	//   returns 4: 'zyyx'
	//   example 5: strtr('zyyx', 'pthxyz', 'xyzpth')
	//   returns 5: 'http'

	if (!isString(trFrom))		{
		throw new Error('"trFrom" parameter needs to be a string.');
	}
	if (!isString(trTo))		{
		throw new Error('"trTo" parameter needs to be a string.');
	}
	if (trFrom.length != trTo.length)		{
		throw new Error('"trFrom" and "trTo" need to be the same length.');
	}

	// If nothing to replace then just return the original string.
	if (trFrom.length <= 0)		{
		return _this;
	}

	// Create character mapping.
	let map = new Map();
	trFrom = trFrom.split('');
	trTo = trTo.split('');
	for (let i = 0; i < trFrom.length; i++)		{
		map.set(trFrom[i], trTo[i]);
	}

	// Replace the characters.
	let str = '';
	_this.split('').forEach((c) => {
		if (map.has(c)) {
			str += map.get(c);
		}	else {
			str += c;
		}
	});

	return str;
}

/**
 * This function is used to generate the JWT secret.
 *
 * @param {integer} [size=20] The size of the token will be size*3 Bytes. This will produce size*4 characters.
 *
 * @return {string}
 */
// This function is used to generate the JWT secret.
function generateSecret(size = 20) {
	// Generate a random token.
	//    http://stackoverflow.com/questions/8855687/secure-random-token-in-node-js
	//    http://stackoverflow.com/questions/1856785/characters-allowed-in-a-url
	//    Allowed chars in url: [A-Za-z0-9_.-~] and [%] for encoding
	//    http://stackoverflow.com/questions/13195143/range-of-valid-character-for-a-base-64-encoding
	//    Char is base64: [A-Za-z0-9+/] and [=] for padding

	// Token byte size should be a multiple of 3 so that there is no base64 padding added (=).
	const tokenSize = 3 * size;

	// Repeat until the generated token is unique.
	return strtr(crypto.randomBytes(tokenSize).toString('base64'), '/+', '_-');
}

/**
 * Generate a random string.
 *
 * @param {integer} len Length of the randomly generated string.
 * @param {string} charSet Set of characters that can be used in the random generation process.
 *
 * @returns {string} Random secret.
 */
function randomString(len = 30, charSet = 'abcdefghijklmnopqrstuvwxyz') {
	let str = '';
	for (let i = 0; i < len; i++) {
		str += charSet.charAt(Math.floor(Math.random() * charSet.length));
	}
	return str;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	strtr,
	generateSecret,
	randomString,
};
