'use strict';

const Role = require('../models/role');

const ROLES = [
	{ name: 'admin',
		display_name: 'Admin',
		description: 'Admin user' },
	{ name: 'user',
		display_name: 'User',
		description: 'Normal user' },
];

exports.up = async function(knex) {
	await knex.schema.createTable('roles', (table) => {
		// table.charset('utf8');
		// table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();

		table.string('name').notNullable().unique();
		table.string('display_name').notNullable();
		table.text('description', 'longtext').nullable();
	});

	// Insert roles.
	// let roles = Role.collection();
	// for (let role of ROLES) roles.add(role);
	// await roles.insert();
};

exports.down = async function(knex) {
	await knex.schema.dropTable('roles');
};
