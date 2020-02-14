'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('work', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();
		table.integer('user_id').unsigned().nullable().references('users.id').onUpdate('CASCADE').onDelete('RESTRICT');
		table.integer('project_id').unsigned().nullable().references('project.id').onUpdate('CASCADE').onDelete('RESTRICT');
		// TODO: type to string
		table.integer('type_id').unsigned().nullable().references('work_types.id').onUpdate('CASCADE').onDelete('RESTRICT');
		table.datetime('start').notNullable().index();
		table.datetime('end').notNullable().index();
		table.string('day').notNullable().index();
		// TODO: Maybe add month.
		table.integer('time_elapsed').notNullable().index();
		table.string('description', 'longtext').nullable();

		// Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('work');
};

