'use strict';

exports.up = async function(knex) {
	await knex.schema.createTable('users', (table) => {
		table.charset('utf8');
		table.collate('utf8_unicode_ci');

		// Primary key.
		table.increments('id').unsigned().primary();

		// Credentials.
		table.string('email').notNullable().index();
		table.string('password', 128).nullable();

		// State.
		table.timestamp('email_verified_at').nullable().index();
		table.integer('jwt_password_reset_counter').unsigned().notNullable().defaultTo(0);

		// Info. TODO: add type!!!
		table.string('first_name').nullable().index();
		table.string('last_name').nullable().index();
		table.string('position').nullable().index(); // Backend, Frontend, Fullstack

		// Statistics.
		// Moved to comoany data table.
		// table.string('data', 'long').nullable();
		// table.integer('holiday_days').notNullable().index();
		// table.integer('sick_leave_days').notNullable().index();
		// table.integer('work_from_home_hours').notNullable().index();
		// table.integer('commute_distance').notNullable().index();

		// Notifications.
		table.string('backup_email').nullable().index();
		table.string('work_phone').nullable().index();
		table.string('private_phone').nullable().index();
		table.string('profile_picture_url').nullable();

		// table.boolean('is_sms_notify_enabled').notNullable().defaultsTo(false).index();
		// table.string('notify_phone').nullable().index();
		// table.boolean('is_email_notify_enabled').notNullable().defaultsTo(false).index();
		// table.string('notify_email').nullable().index();
		// table.boolean('is_push_notify_enabled').notNullable().defaultsTo(false).index();

		// Timestamps.
		table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now()).index();
		table.timestamp('deleted_at').nullable().index(); // Soft delete (used for keeping history).
	});
};

exports.down = async function(knex) {
	await knex.schema.dropTable('users');
};
