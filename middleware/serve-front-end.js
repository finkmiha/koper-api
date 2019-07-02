'use strict';

const fs = require('fs');
const path = require('path');
const KoaStatic = require('koa-static');
const koaSend = require('koa-send');
const util = require('util');
const exists = util.promisify(fs.exists);

let FRONTEND_FOLDER = null;
if (process.env.FRONTEND_FOLDER != null) {
	FRONTEND_FOLDER = path.resolve(__dirname, '..', process.env.FRONTEND_FOLDER);
} else {
	FRONTEND_FOLDER = path.resolve(__dirname, '../frontend');
}

const CACHE_MAXAGE = 7 * 24 * 60 * 60 * 1000; // 7 days in miliseconds.
// eslint-disable-next-line new-cap
const serve = KoaStatic(FRONTEND_FOLDER, { maxage: CACHE_MAXAGE });

/**
 * Middleware which servers the index.html file.
 */
async function middleware(ctx, next) {
	// If no route matched serve index.html.
	let indexExists = await exists(path.resolve(FRONTEND_FOLDER, './index.html'));
	if (indexExists) {
		await serve(ctx, async () => {
			await koaSend(ctx, './index.html', { root: FRONTEND_FOLDER });
		});
	} else {
		await koaSend(ctx, './compiling-frontend.html', { root: path.resolve(__dirname, '../views') });
	}
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = middleware;
