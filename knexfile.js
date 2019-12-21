'use strict';

const path = require('path');

// Load .env configuration.
require(path.resolve(__dirname, './load-env'));

module.exports = {
	client: 'pg',
	connection: {
		host: process.env.MYSQL_HOST,
		port: process.env.MYSQL_PORT,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD,
		database: process.env.MYSQL_DATABASE,
		charset: 'utf8',
		timezone: 'UTC',
	},
	pool: {
		min: 2,
		max: 10,
	},
	migrations: {
		directory: path.resolve(__dirname, './migrations'),
		tableName: 'migrations',
	},
	debug: process.env.KNEX_DEBUG === 'true',
};
