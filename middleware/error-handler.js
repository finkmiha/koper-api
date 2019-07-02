'use strict';

/**
 * Error handler middleware.
 */
async function middleware(ctx, next) {
	try {
		// eslint-disable-next-line callback-return
		await next();

		if (ctx.status !== 200) {
			ctx.throw(ctx.status, ctx.message);
		}
	} catch (err) {
		// Respond differently to different types of errors.
		switch (err.name) {
			case 'TokenExpiredError':
				ctx.status = 401;
				ctx.body = {
					message: ctx.i18n.__('JWT token has expired.'),
				};
				break;
			case 'JsonWebTokenError':
				ctx.status = 401;
				ctx.body = {
					message: ctx.i18n.__('JWT token is invalid.'),
				};
				break;
			case 'ValidationError':
				ctx.status = 400;
				// Handle Joi validation errors
				if (err.details.length > 0) {
					let details = err.details[0];
					if (details.type === 'string.regex.name') {
						ctx.body = {
							message: details.context.name,
						};
					} else {
						ctx.body = {
							message: details.message,
						};
					}
				} else {
					ctx.body = {
						message: ctx.i18n.__('Input validation failed.'),
					};
				}
				break;
			default:
				// Some errors will have .status. However this is not a guarantee.
				ctx.status = err.status || 500;
				if (ctx.status === 500) {
					if (process.env.NODE_ENV === 'development' ||
						process.env.NODE_ENV === 'stage') {
						ctx.body = {
							message: err.message,
							stack: err.stack,
						};
					} else {
						ctx.body = {
							message: ctx.i18n.__('Something went wrong. Please try again.'),
							error: err.message,
							stack: err.stack,
						};
					}

					// Since we handled this manually we'll
					// want to delegate to the regular app
					// level error handling as well so that
					// centralized still functions correctly.
					// eslint-disable-next-line no-invalid-this
					ctx.app.emit('error', err, this);
				} else {
					ctx.body = {
						message: err.message,
					};
				}
				if (err.field != null) ctx.body.field = err.field;
				break;
		}
	}
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = middleware;
