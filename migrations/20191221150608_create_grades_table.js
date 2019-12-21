'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('grades', (table) => {
		// Primary key.
		table.increments('id').unsigned().primary();

        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.integer('route_id').unsigned().notNullable().references('routes.id').onDelete('CASCADE');
        table.string('name').notNullable().index();

        // Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('grades');
};
