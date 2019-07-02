'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('user_data', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();
		table.integer('user_id').unsigned().notNullable().references('users.id').onUpdate('CASCADE').onDelete('RESTRICT');
		table.string('key').notNullable().index();
		table.text('value').nullable();

		// Timestamps.
		table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now()).index();
		table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now());
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('user_data');
};
