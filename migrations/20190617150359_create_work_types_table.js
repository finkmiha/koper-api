'use strict';

// Key_name display_name type
exports.up = async (knex) => {
	await knex.schema.createTable('work_types', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();
		table.string('type').notNullable().index(); //  Tip dela: Efektivno delo, Dopust, bolniska, koriscenje ekstra ur, delo od doma …
	});
};

exports.down = async (knex) => {
	await knex.schema.dropTable('work_types');
};
