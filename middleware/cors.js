'use strict';

/**
 * CORS middleware.
 * Access-Control-Allow-Origin set to any URL if in development mode.
 */
async function middleware(ctx, next) {
	// eslint-disable-next-line callback-return
	await next();
	
	let origin = '*';
	if (ctx.request.headers.origin != null) origin = ctx.request.headers.origin;
	ctx.set('Access-Control-Allow-Origin', origin);
	ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, CST, X-SECURITY-TOKEN, X-Requested-With, Content-Length, cache-control');
	ctx.set('Access-Control-Allow-Methods', 'HEAD,OPTIONS,GET,POST,PUT,DELETE');
	ctx.set('Allow', 'HEAD,OPTIONS,GET,POST,PUT,DELETE');
	ctx.set('Access-Control-Expose-Headers', 'date, set-cookie, ' +
		'x-set-auth-token, x-response-time, x-deprecated');
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = middleware;
