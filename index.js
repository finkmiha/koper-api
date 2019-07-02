'use strict';

// Load .env configuration.
process.chdir(__dirname);
require('./load-env');

const path = require('path');
const Koa = require('koa');
const Log = require('unklogger');

const DatabaseHelper = require('./helpers/database');
const AuthHelper = require('./helpers/auth');

// Require middleware.
const mwLogger = require('./middleware/logger');
const mwCORS = require('./middleware/cors');
const mwOptions = require('./middleware/options');
const mwErrorHandler = require('./middleware/error-handler');
const mwIP = require('./middleware/ip');
const mwPublic = require('./middleware/serve-public-folder');
const mw404 = require('./middleware/404');
const routes = require('./routes');
const mwI18n = require('./middleware/i18n');
const mwFrontEnd = require('./middleware/serve-front-end');

// Async wrapper. Enable await calls.
(async () => {
	await DatabaseHelper.waitForDatabase();
	if (process.env.AUTO_MIGRATE_DB === 'true') {
		await DatabaseHelper.createDatabase(); // Create database if it does not exists.
		await DatabaseHelper.migrateLatest(); // Run latest database migrations.
	}
	await AuthHelper.init();

	// Create a Koa server instance.
	const app = new Koa();
	// Error handler - If the error reaches the bottom of the stack.
	app.on('error', (err) => {
		Log.error(err.message);
		Log.error(err.stack);
	});

	// Middleware.
	app.use(mwLogger);
	if (process.env.NODE_ENV === 'development' ||
		process.env.NODE_ENV === 'stage') {
		app.use(mwCORS);
	}
	app.use(mwOptions);
	app.use(mwErrorHandler);
	app.use(mwIP);
	app.use(mwI18n(app));

	// Routes.
	await routes.applyUse(app);
	// await routesAdmin.applyUse(app);

	// Middleware after routes.
	app.use(mwPublic);
	app.use(mw404);
	app.use(mwFrontEnd);

	// Start the server.
	let server = app.listen(process.env.SERVER_PORT || 3000);
	if (server.address() === null) {
		let errMsg = 'Error: Please select a different server port by configuring the ".env" file.';
		Log.error(errMsg);
		process.exit(1);
	}
	Log.success('Server: http://127.0.0.1:' + server.address().port);
})().catch((err) => {
	Log.error('Error: Server failed to start.');
	Log.error(err);
	process.exit(1);
});
