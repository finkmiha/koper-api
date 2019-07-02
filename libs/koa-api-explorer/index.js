'use strict';

const path = require('path');
const callsite = require('callsite');
const KoaRouterSwagger = require('koa-oai-router').default;

const assign = require('lodash.assign');
const pick = require('lodash.pick');
const isString = require('lodash.isstring');

const DocsBuilder = require('./swagger-docs-builder');

// Helper functions to get the caller directory path.
// Source: https://stackoverflow.com/questions/18144921/how-do-i-get-the-dirname-of-the-calling-method-when-it-is-in-a-different-file-in
function getCallerDirectory() {
	let stack = callsite();
	let requester = stack[2].getFileName();
	return path.dirname(requester);
}

// TODO: idea groupBy: group routes by controller/file name or group them by route alias prefix.
// TODO: auto create folders if they do not exist

// eslint-disable-next-line padded-blocks
class KoaApiExplorer {

	/**
	 * KoaApiExplorer constructor.
	 *
	 * @param {object} options Config object.
	 *
	 * @param {string} [options.docsDir="./docs"] Base dir for all generated files.
	 * @param {string} [options.apiDoc="./api.yaml"] Path of the api.yaml doc file.
	 * @param {string} [options.stateDoc="./state.json"] Path of the state.json file. State of the API is stored in this file so that it does not rebuild every time.
	 * @param {string} [options.routesFile="./routes.js"] Routes file.
	 * @param {string} [options.controllerDir="./controllers"] Dir of controllers.
	 * @param {string} [options.server] Get listening port from server.
	 * @param {string} [options.port] Get listening port from server.
	 * @param {boolean} [options.versioning=false] Add major version to api prefix.
	 * @param {boolean} [options.apiExplorerVisible=true] Show api-explorer.
	 *
	 * @param {KoaRouter} options.router KoaRouter instance.
	 * @param {string} options.version API version.
	 * @param {string} options.title API title.
	 * @param {string} [options.description] API description.
	 * @param {string} [options.contactName] Developer contact name.
	 * @param {string} [options.contactEmail] Developer contact email.
	 * @param {string|boolean} [options.routesExportDoc=false] Path of the routes.json file. You can export routes in json format to this file for any use.
	 * @param {boolean} [options.alwaysGenerate=false] Re-generate documentation files each time the application is restarted.
	 * @param {boolean} [options.autoGenerate=true] Generate the docs immediately after the instance is created.
	 */
	constructor(options) {
		// Caller directory.
		let callerDir = getCallerDirectory();

		// Validate options.
		options = options || {};
		options.routesFile = path.resolve(callerDir, options.routesFile || './routes.js');
		options.controllerDir = path.resolve(callerDir, options.controllerDir || './controllers');
		options.docsDir = path.resolve(callerDir, options.docsDir || './docs');

		options.apiDoc = path.resolve(callerDir, options.apiDoc || path.resolve(options.docsDir, './api.yaml'));
		options.stateDoc = path.resolve(callerDir, options.stateDoc || path.resolve(options.docsDir, './state.json'));
		if (options.routesExportDoc === true) {
			options.routesExportDoc = path.resolve(options.docsDir, './routes.json');
		} else if (isString(options.routesExportDoc)) {
			options.routesExportDoc = path.resolve(callerDir, options.routesExportDoc);
		} else {
			options.routesExportDoc = null;
		}

		if (options.versioning == null) options.versioning = false;
		options.versioning = options.versioning == true;
		if (options.apiExplorerVisible == null) options.apiExplorerVisible = true;
		options.apiExplorerVisible = options.apiExplorerVisible == true;

		if (options.router == null) throw new Error('router parameter missing.');
		if (!isString(options.version)) throw new Error('version parameter missing.');
		if (!isString(options.title)) throw new Error('title parameter missing.');
		if (!isString(options.description)) options.description = null;
		if (!isString(options.contactName)) options.contactName = null;
		if (!isString(options.contactEmail)) options.contactEmail = null;

		if (options.alwaysGenerate == null) options.alwaysGenerate = false;
		options.alwaysGenerate = options.alwaysGenerate == true;
		if (options.autoGenerate == null) options.autoGenerate = true;
		options.autoGenerate = options.autoGenerate == true;

		this._options = options;

		// Generate docs.
		if (options.autoGenerate) {
			this.generate();
		}

		// Create API explorer.
		this._swagger = new KoaRouterSwagger(pick(options, [
			'apiDoc',
			'controllerDir',
			'server',
			'port',
			'versioning',
			'apiExplorerVisible',
		]));
	}

	generate() {
		DocsBuilder.generate(this._options);
	}

	/**
	 * Get API-Explorer routes middleware.
	 */
	routes() {
		return this._swagger.routes();
	}

	/**
	 * Get API-Explorer apiExplorer middleware.
	 */
	apiExplorer() {
		return this._swagger.apiExplorer();
	}
}

module.exports = KoaApiExplorer;
