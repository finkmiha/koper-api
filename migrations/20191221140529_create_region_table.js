'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('regions', (table) => {
		// Primary key.
		table.increments('id').unsigned().primary();

		table.string('name').notNullable().unique();
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('regions');
};
