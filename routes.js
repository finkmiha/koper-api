'use strict';

const KoaRouter = require('koa-router');
const KoaRouterGroups = require('koa-router-groups');
const KoaApiExplorer = require('./libs/koa-api-explorer/index');

// Require middleware.
const koaBody = require('koa-body');
const AuthMiddleware = require('./middleware/auth');

// Require all exposed controllers.
const AuthController = require('./controllers/auth');
const UserController = require('./controllers/user');
const ApiKeyController = require('./controllers/api-key');
const VerifyController = require('./controllers/verify');
const ProjectController = require('./controllers/project');
const WorkTypeController = require('./controllers/work-type');
const WorkController = require('./controllers/work');
const ExportController = require('./controllers/export');
const ImportController = require('./controllers/import');

// Create koa router instance.
let router = new KoaRouter({
	prefix: '/api',
});
KoaRouterGroups.extend(router);

// Register middleware.
router.registerMiddleware('body', koaBody({
	jsonLimit: '50mb',
	formLimit: '50mb',
	textLimit: '50mb',
	multipart: true,
	parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
}));
router.registerMiddleware('auth', AuthMiddleware.auth);
// router.registerMiddleware('autoAuth', AuthMiddleware.autoAuth); // Automatically login as super admin.
// router.registerMiddleware('user', AuthMiddleware.roles(['user']));
// router.registerMiddleware('freelancer', AuthMiddleware.roles(['freelancer']));
// router.registerMiddleware('brand', AuthMiddleware.roles(['brand']));
// router.registerMiddleware('admin', AuthMiddleware.roles(['admin']));

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
router.post('users.store', '/users/store', UserController.store);
router.get('users.email.show', '/users/email', UserController.showEmail);

// Verification.
router.post('verify.sendEmail', '/verify/send/email', VerifyController.sendVerifyEmail);
router.post('verify.verifyToken', '/verify/verify/token', VerifyController.verifyToken);
router.post('verify.verify', '/verify/verify', VerifyController.verify);

// Auth group. Any routes in this group need to pass the "AuthMiddleware.auth" middleware.
router.group('auth', () => {
	// Auth.
	router.get('auth.logout', '/auth/logout', AuthController.logout);

	// User.
	router.post('users.store', '/users/store', UserController.store);
	router.get('users.email.show', '/users/email', UserController.showEmail);
	router.get('users.showMe', '/users/me', UserController.showMe);
	router.put('users.updateMe', '/users/me', UserController.updateMe);
	router.del('users.destroyMe', '/users/me', UserController.destroyMe);

	// API keys.
	router.get('api-keys.index', '/api-keys', ApiKeyController.index);
	router.post('api-keys.store', '/api-keys', ApiKeyController.store);
	router.put('api-keys.update', '/api-keys/:id(\\d+)', ApiKeyController.update);
	router.del('api-keys.destroy', '/api-keys/:id(\\d+)', ApiKeyController.destroy);

	// Project.
	router.post('project.store', '/project/store', ProjectController.store);
	router.get('project.index', '/project/all', ProjectController.index);
	router.get('project.index', '/project/work/all', ProjectController.getWorkProjects);
	router.put('project.update', '/project/:id(\\d+)/update', ProjectController.update);
	router.del('project.delete', '/project/:id(\\d+)/delete', ProjectController.destroy);

	// Work type.
	router.post('type.store', '/type', WorkTypeController.store);
	router.get('type.index', '/type/all', WorkTypeController.index);
	router.put('type.update', '/type/:id(\\d+)/update', WorkTypeController.update);
	router.del('type.delete', '/type/:id(\\d+)/delete', WorkTypeController.destroy);

	// Work.
	router.get('work.show', '/work', WorkController.showWork);
	router.get('work.stats', '/work/stats/month', WorkController.monthlyWorkStats);
	router.get('work.stats.all', '/work/stats/all', WorkController.allTimeWorkStats);
	router.post('work.store', '/work/store', WorkController.storeWork);
	router.put('work.update', '/work/:id(\\d+)/update', WorkController.updateWork);
	router.del('work.delete', '/work/:id(\\d+)/delete', WorkController.deleteWork);
	router.post('work.day', '/work/day', WorkController.dailyWork);
	router.post('work.project', '/work/project', WorkController.projectWork);

	// Work export
	router.post('work.me.export', '/work/me/export', ExportController.exportMyWork);

	// Work import.
	router.post('work.me.import.store', '/work/me/import', ImportController.store);
	router.post('work.me.import.store.bulk', '/work/me/import/bulk', ImportController.storeBulk);
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
			contactName: 'SignApps Team',
			contactEmail: 'info@signapps.io',
		});
		app.use(explorer.apiExplorer());
	}
}

module.exports = {
	router,
	applyUse,
};
