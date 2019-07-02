'use strict';

function isLocalhost(ip) {
	return [
		'127.0.0.1',
		'::ffff:127.0.0.1',
		'::1',
	].includes(ip);
}

async function middleware(ctx, next) {
	let ip = ctx.ip;
	if (isLocalhost(ip)) {
		// Check the x-real-ip header.
		if ((ctx.headers != null) && (ctx.headers['x-real-ip'] != null)) {
			ip = ctx.headers['x-real-ip'];
		}
	}
	if (ctx.state == null) ctx.state = {};
	ctx.state.ip = ip;
	await next();
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = middleware;
