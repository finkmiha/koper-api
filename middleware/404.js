'use strict';

function checkUrl(ctx, baseUrl) {
	if (ctx.url === baseUrl) return true;
	if (ctx.url.startsWith(`${baseUrl}/`)) return true;
	return false;
}

/**
 * Middleware which returns 404 on reserved routes.
 *
 * @reviewedBy TODO
 */
async function middleware(ctx, next) {
	// Reutrn 404 on reserved routes.
	if (checkUrl(ctx, '/api')) return;
	if (checkUrl(ctx, '/api-explorer')) return;
	if (checkUrl(ctx, '/koa-oai-router')) return;

	// Reutrn 404 for public and web folders.
	if (checkUrl(ctx, '/uploads')) return;

	// Proceed for other routes.
	await next();
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = middleware;
