'use strict';

const connection = require('../knexfile');

let database = connection.connection.database;
delete connection.connection.database;

const Knex = require('knex')(connection);

Knex.raw('CREATE DATABASE ?? DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;', database).then(() => {
	console.log(`Database "${database}" created.`);
	process.exit(0);
}).catch(error => {
	console.error(error.message);
	console.error('Exit.');
	process.exit(1);
});
