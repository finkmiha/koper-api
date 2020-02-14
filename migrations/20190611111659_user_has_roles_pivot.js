'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('user_has_roles', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		table.integer('user_id').unsigned().notNullable().references('users.id').onUpdate('CASCADE').onDelete('CASCADE');
		table.integer('role_id').unsigned().notNullable().references('roles.id').onUpdate('CASCADE').onDelete('CASCADE');
		table.primary(['user_id', 'role_id']);
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('user_has_roles');
};
