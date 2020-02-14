"use strict";

exports.up = async function(knex) {
	await knex.schema.table("users", function (table) {
		table.string("type").after("id").notNullable().index()
	});
};

exports.down = async function(knex) {
	await knex.schema.table("users", function (table) {
		table.dropColumn("type");
	});
};
