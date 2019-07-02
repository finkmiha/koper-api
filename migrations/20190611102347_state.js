'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('state', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();

		table.string('key').nullable().index();
		table.string('secondary_key').nullable().index();
		table.text('value', 'longtext').nullable();

		// Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('state');
};
