'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('routes', (table) => {
		// Primary key.
		table.increments('id').unsigned().primary();

        table.integer('location_id').unsigned().notNullable().references('locations.id').onDelete('CASCADE');
        table.string('name').notNullable().index();
        table.string('difficulty').nullable().index();
		table.integer('length').nullable().index();
		table.string('sector').nullable().index();
        table.string('first_ascent').nullable().index();
        table.string('source_url').nullable().index();

        // Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('routes');
};
