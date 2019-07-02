'use strict';

const AsyncLock = require('async-lock');
const lock = new AsyncLock();

const isArray = require('lodash/isArray');
const flattenDeep = require('lodash/flattenDeep');

const State = require('../models/state');
const cache = new Map();
const promiseCache = new Map();

function _cacheValue(promise, lockKey, strValue) {
	if (!promiseCache.has(lockKey)) promiseCache.set(lockKey, new Set());
	promiseCache.get(lockKey).add(promise);
	cache.set(lockKey, strValue);
	promise.then(() => {
		let promiseSet = promiseCache.get(lockKey);
		promiseSet.delete(promise);
		if (promiseSet.size <= 0) {
			// Remove key from cache.
			promiseCache.delete(lockKey);
			cache.delete(lockKey);
		}
	});
}

/**
 * Store value.
 *
 * @param {string} key
 * @param {string} [secondary_key]
 * @param {mixed} value Value needs to be a serializable JSON object.
 */
function set(...args) {
	if (args.length < 2) throw new Error('Key and value are required parameters.');
	if (args.length > 3) throw new Error('Cannot accept more than 3 arguments.');
	let key = args.shift();
	let value = args.pop();
	let secondary_key = null;
	if (args.length > 0) secondary_key = args.shift();

	let lockKey = JSON.stringify({k: key, k2: secondary_key});
	let strValue = JSON.stringify(value);
	let promise = lock.acquire(lockKey, async function() {
		// Check if value already exists.
		let state = await State.select('id').where('key', key).where('secondary_key', secondary_key).first();
		if (state == null) {
			state = new State({
				key: key,
				secondary_key: secondary_key,
			});
		}

		// Update & Save.
		state.set('value', strValue);
		await state.save();
	});
	_cacheValue(promise, lockKey, strValue);
	return promise;
}

/**
 * Soft delete any previous values and store the new value.
 *
 * @param {string} key
 * @param {string} [secondary_key]
 * @param {mixed} value Value needs to be a serializable JSON object.
 */
function softSet(...args) {
	if (args.length < 2) throw new Error('Key and value are required parameters.');
	if (args.length > 3) throw new Error('Cannot accept more than 3 arguments.');
	let key = args.shift();
	let value = args.pop();
	let secondary_key = null;
	if (args.length > 0) secondary_key = args.shift();

	// Create state model to check if value is JSON serializable.
	let strValue = JSON.stringify(value);
	let state = new State({
		key: key,
		secondary_key: secondary_key,
		value: strValue,
	});

	let lockKey = JSON.stringify({k: key, k2: secondary_key});
	let promise = lock.acquire(lockKey, async function() {
		// Soft delete any previous values.
		await State.where('key', key).where('secondary_key', secondary_key).delete();

		// Store the new value.
		await state.save();
	});
	_cacheValue(promise, lockKey, strValue);
	return promise;
}

/**
 * Check if key exists.
 *
 * @param {string} key
 * @param {string} [secondary_key]
 *
 * @returns {boolean}
 */
async function has(key, secondary_key = null) {
	let count = null;

	let lockKey = JSON.stringify({k: key, k2: secondary_key});
	if (cache.has(lockKey)) return true;
	await lock.acquire(lockKey, async function() {
		count = await State.where('key', key).where('secondary_key', secondary_key).count();
	});

	return (count > 0);
}

/**
 * Bulk get values by keys.
 *
 * @param {string[][]} keys Resource keys.
 *
 * @returns {mixed[]}
 */
async function getBulk(keys) {
	if (!isArray(keys)) throw new Error("'keys' must be an array.");
	let values = [];
	let collection = State.collection();
	for (let keyArray of keys) {
		let key = null;
		if (keyArray.length >= 1) key = keyArray[0];
		let secondary_key = null;
		if (keyArray.length >= 2) secondary_key = keyArray[1];
		let lockKey = JSON.stringify({k: key, k2: secondary_key});
		if (cache.has(lockKey)) {
			values.push({
				isModel: false,
				value: JSON.parse(cache.get(lockKey)),
			});
		} else {
			values.push({
				isModel: true,
				value: collection.addMemo({
					key: key,
					secondary_key: secondary_key,
				}, ['key', 'secondary_key']),
			});
		}
	}
	if (collection.length > 0) await collection.selectBy(['key', 'secondary_key'], ['value']);
	values = values.map(v => {
		if (v.isModel) {
			if (v.value.has('value')) return JSON.parse(v.value.get('value'));
			else return null;
		}
		else return v.value;
	});
	return values;
}

/**
 * Get value by key.
 * If key does not exist null is returned.
 *
 * @param {string} key
 * @param {string} [secondary_key]
 *
 * @returns {mixed}
 */
async function get(key, secondary_key = null) {
	let values = await getBulk([[key, secondary_key]]);
	return values[0];
}

async function flush() {
	// Get all promises.
	let promises = flattenDeep(Array.from(promiseCache.values()).map(s => Array.from(s)));
	await Promise.all(promises);
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	set,
	softSet,
	has,
	getBulk,
	get,
	flush,
};
