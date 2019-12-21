'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('locations', (table) => {
		// Primary key.
		table.increments('id').unsigned().primary();

        table.integer('region_id').unsigned().notNullable().references('regions.id').onDelete('CASCADE');
        table.string('name').notNullable().index();
        table.string('description').nullable();
        table.string('source_url').nullable().index();

        // Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('locations');
};
