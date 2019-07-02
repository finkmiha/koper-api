'use strict';

const Log = require('unklogger');
const knexConstructor = require('knex');
const connection = require('../knexfile');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDatabase() {
	let connectionWithoutDB = JSON.parse(JSON.stringify(connection));
	delete connectionWithoutDB.connection.database;
	let knex = knexConstructor(connectionWithoutDB);
	while (true) {
		try {
			await knex.raw('SELECT \'Connection test.\';');
			Log.success('Database connection established.');
			return;
		} catch (error) {
			Log.info('Waiting for database connection ...');
			await sleep(5000);
		}
	}
}

async function createDatabase() {
	try {
		let database = connection.connection.database;
		let connectionWithoutDB = JSON.parse(JSON.stringify(connection));
		delete connectionWithoutDB.connection.database;
		let knex = knexConstructor(connectionWithoutDB);

		let existsResp = await knex.raw('SHOW DATABASES LIKE ?;', database);
		if (existsResp[0].length > 0) {
			Log.info(`Database "${database}" already exists.`);
		} else {
			let resp = await knex.raw('CREATE DATABASE IF NOT EXISTS ?? DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;', database);
			if (resp[0].affectedRows > 0) {
				Log.success(`Database "${database}" created.`);
			} else {
				Log.info(`Database "${database}" already exists.`);
			}
		}
	} catch (error) {
		Log.error(error.message);
		Log.error('Exit.');
	}
}

async function migrateLatest() {
	let knex = knexConstructor(connection);
	Log.info('Running latest migrations ...');
	let resp = await knex.migrate.latest();
	if (resp[1].length > 0) {
		Log.success(`Batch ${resp[0]} run: ${resp[1].length} migrations.`);
	} else {
		Log.info('Migrations already up to date.');
	}
}

module.exports = {
	waitForDatabase,
	createDatabase,
	migrateLatest,
};

