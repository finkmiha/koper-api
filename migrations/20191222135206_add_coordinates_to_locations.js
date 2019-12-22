'use strict';

exports.up = async function(knex) {
	await knex.schema.table('locations', (table) => {
		table.decimal('lat', 20, 8).after('name').nullable().index();
		table.decimal('lng', 20, 8).after('lat').nullable().index();
	});
};

exports.down = async function(knex) {
	await knex.schema.table('locations', (table) => {
		table.dropColumn('lat');
		table.dropColumn('lng');
	});
};