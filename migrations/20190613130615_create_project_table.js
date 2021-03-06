'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('project', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();

		table.string('name').nullable().index();
		table.string('tag').nullable().index();

		// Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('project');
};
