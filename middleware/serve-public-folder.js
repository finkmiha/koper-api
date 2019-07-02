'use strict';

const path = require('path');
const KoaStatic = require('koa-static');

const PUBLIC_FOLDER = path.resolve(__dirname, '../public');
const CACHE_MAXAGE = 24*60*60*1000; // 1 day in miliseconds.
const serve = KoaStatic(PUBLIC_FOLDER, { maxage: CACHE_MAXAGE });

/**
 * Middleware that serves the public folder.
 * Serve uploaded files (example: profile pictures, ...).
 *
 * @type {Object}
 */
module.exports = serve;
