'use strict';

/**
 * Options middleware.
 * Send a 200 OK response to OPTIONS requests.
 */
async function middleware(ctx, next) {
	if (ctx.method === 'OPTIONS') {
		ctx.status = 200;
	} else {
		// eslint-disable-next-line callback-return
		await next();
	}
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = middleware;
