'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('api_keys', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();
		table.integer('user_id').unsigned().notNullable().references('users.id').onUpdate('CASCADE').onDelete('RESTRICT');
		table.boolean('enabled').notNullable().defaultsTo(false).index();
		table.timestamp('expires_at').nullable().index();
		table.string('name').nullable().index();
		table.string('key').notNullable().index();
		table.text('description', 'longtext').nullable();

		// Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('api_keys');
};
