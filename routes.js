'use strict';

const KoaRouter = require('koa-router');
const KoaRouterGroups = require('koa-router-groups');
const KoaApiExplorer = require('./libs/koa-api-explorer/index');

// Require middlewares.
const koaBody = require('koa-body');
const AuthMiddleware = require('./middleware/auth');

// Require all exposed controllers.
const AuthController = require('./controllers/auth');
const UserController = require('./controllers/user');
const VerifyController = require('./controllers/verify');
const LocationController = require('./controllers/location');
const RouteController = require('./controllers/route');

// Create koa router instance.
let router = new KoaRouter({
	prefix: '/api',
});
KoaRouterGroups.extend(router);

// Register middlewares.
router.registerMiddleware('body', koaBody({
	jsonLimit: '50mb',
	formLimit: '50mb',
	textLimit: '50mb',
	multipart: true,
	strict: false,
}));
router.registerMiddleware('auth', AuthMiddleware.auth);

/***********************************************************************************
 *
 * ROUTE DEFINITIONS
 *
 ***********************************************************************************/

// Push the middleware used by all routes to the stack.
router.pushMiddleware('body');

// Routes outside any auth groups will be accessible to everyone
// because they will have to pass no auth middleware.

// Auth.
router.post('auth.login', '/auth/login', AuthController.login);

// User.
// User register.
router.post('users.store', '/users', UserController.store);
router.get('users.email.show', '/users/email', UserController.showEmail);

// Verification.
router.post('verify.sendEmail', '/verify/send/email', VerifyController.sendVerifyEmail);
router.post('verify.verifyToken', '/verify/verify/token', VerifyController.verifyToken);
router.post('verify.verify', '/verify/verify', VerifyController.verify);

// Location
router.get('location.index', '/location/all', LocationController.index);
router.get('location.location', '/location/:id(\\d+)', LocationController.getLocation);

// Route
router.get('route.route', '/route/:id(\\d+)', RouteController.getRoute);

// Auth group. Any routes in this group need to pass the "AuthMiddleware.auth" middleware.
router.group('auth', () => {
	// Auth.
	router.get('auth.logout', '/auth/logout', AuthController.logout);

	// User.
	router.post('users.store', '/users', UserController.store);
	router.get('users.email.show', '/users/email', UserController.showEmail);
	router.get('users.showMe', '/users/me', UserController.showMe);
	router.put('users.updateMe', '/users/me', UserController.updateMe);
	router.del('users.destroyMe', '/users/me', UserController.destroyMe);
});

/**
 * Apply routes middleware function.
 *
 * @param {Koa} app
 */
async function applyUse(app) {
	// Attach the router to ctx.state so that every controller can access it.
	app.use(async (ctx, next) => {
		ctx.state.router = router;
		await next();
	});

	// Apply the routes to the app.
	app.use(router.routes()).use(router.allowedMethods());

	// API Explorer.
	if (process.env.NODE_ENV === 'development' ||
		process.env.NODE_ENV === 'stage') {
		let explorer = new KoaApiExplorer({
			routesFile: __filename,
			controllerDir: './controllers',
			docsDir: './docs',
			routesExportDoc: true,
			port: process.env.SERVER_PORT || 3000,
			router: router,
			version: '1.0.0',
			title: 'API Explorer ' + process.env.NODE_ENV_ALIAS,
			description: 'API.',
			contactName: 'Heckatlon Koper',
			contactEmail: 'mihafink333@gmail.com',
		});
		app.use(explorer.apiExplorer());
	}
}

module.exports = {
	router,
	applyUse,
};
