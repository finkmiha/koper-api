"use strict";

exports.up = async function(knex) {
	await knex.schema.table("project", function (table) {
		table.string("color").after("tag").nullable();
	});
};

exports.down = async function(knex) {
	await knex.schema.table("project", function (table) {
		table.dropColumn("color");
	});
};
