'use strict';

const bcrypt = require('bcryptjs');
const moment = require('moment');
const ApiKey = require('../models/api-key');
const SecretHelper = require('../helpers/secret');
const LockHelper = require('../helpers/lock');

let API_KEYS = new Map();
let LOADED = false;

function scheduleReload() {
	reload();
	setInterval(reload, 30 * 1000);
}

async function reload() {
	try {
		let keys = await ApiKey.select(['id', 'expires_at', 'key']).isValid().get();
		keys = keys.map(k => k.attributes);
		API_KEYS = new Map();
		for (let k of keys) API_KEYS.set(k.id, k);
		LOADED = true;
	} catch (error) { }
}

async function check(key) {
	let inx = key.indexOf('_');
	if (inx < 0) throw new Error('Invalid API key format.');
	let id = parseInt(key.substr(0, inx));
	key = key.substr(inx + 1);
	let keyObj = API_KEYS.get(id);
	if (keyObj == null) throw new Error('API key not found.');
	if (keyObj.expires_at != null) {
		let expAt = moment.utc(keyObj.expires_at, 'X'); // TODO: fix when removing unix format
		if (moment.utc().isAfter(expAt)) throw new Error('API key not found.');
	}
	if (!(await bcrypt.compare(key, keyObj.key))) throw new Error('Invalid API key.');
	return keyObj;
}

/**
 * List all API keys.
 *
 * @param {KoaContext} ctx
 */
async function index(ctx) {
	let keys = await ApiKey.select(['id', 'enabled', 'expires_at', 'name', 'description', 'created_at', 'updated_at']).isOwner(ctx).get();
	keys = keys.toJSON();
	return keys;
}

async function checkDuplicateName(ctx, name) {
	let dupCount = await ApiKey.isOwner(ctx).where('name', name).count();
	ctx.assert(dupCount <= 0, 400, 'An API key with duplicate name already exists.');
}

async function generateKey() {
	let key = SecretHelper.generateSecret(10);
	let hash = await bcrypt.hash(key, 10);
	return {
		key: key,
		hash: hash,
	};
}

/**
 * Create a new API key.
 *
 * @param {KoaContext} ctx
 * @param {object} data API key data.
 */
async function store(ctx, data) {
	await checkDuplicateName(ctx, data.name);
	let key = await generateKey();
	let apiKey = new ApiKey({
		user_id: ctx.state.user.id,
		enabled: data.enabled,
		expires_at: data.expires_at,
		name: data.name,
		key: key.hash,
		description: data.description,
	});
	await apiKey.save();

	// NOTE: do not await.
	if (LOADED) reload();

	apiKey = apiKey.toJSON();
	apiKey.key = `${apiKey.id}_${key.key}`;
	return apiKey;
}
store = LockHelper.lockify(store, (ctx) => [`api_key_create_userId_${ctx.state.user.id}`]);

/**
 * Update an API key by id.
 *
 * @param {KoaContext} ctx
 * @param {integer} id API key id.
 * @param {object} data API key data.
 */
async function update(ctx, id, data) {
	let apiKey = await ApiKey.select(['id']).where('id', id).first();
	ctx.assert(apiKey, 400, `API key with id ${id} not found.`);

	if (data.enabled != null) apiKey.set('enabled', data.enabled);
	if ('expires_at' in data) apiKey.set('expires_at', data.expires_at);
	if (data.description != null) apiKey.set('description', data.description);

	if (Object.keys(apiKey.changed).length > 0) {
		await apiKey.save();
	}

	if (LOADED) reload();

	apiKey = apiKey.toJSON();
	return apiKey;
}

async function destroyHelper(ctx, query) {
	let apiKey = await query.select(['id']).first();
	ctx.assert(apiKey, 400, 'API key not found.');
	await apiKey.delete();

	if (LOADED) reload();
}

/**
 * Destroy an API key by id.
 *
 * @param {KoaContext} ctx
 * @param {integer} id
 */
async function destroy(ctx, id) {
	await destroyHelper(ctx, ApiKey.isOwner(ctx).where('id', id));
}

/**
 * Destroy an API key by name.
 *
 * @param {KoaContext} ctx
 * @param {string} name
 */
async function destroyByName(ctx, name) {
	await destroyHelper(ctx, ApiKey.isOwner(ctx).where('name', name));
}

module.exports = {
	API_KEYS,

	scheduleReload,
	reload,
	check,
	checkDuplicateName,

	index,
	store,
	update,
	destroy,
	destroyByName,
};
