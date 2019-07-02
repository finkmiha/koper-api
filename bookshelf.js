'use strict';

const connection = require('./knexfile');
const Knex = require('knex')(connection);
const Bookshelf = require('bookshelf')(Knex);

// Bookshelf supported plugins.
Bookshelf.plugin('registry');
Bookshelf.plugin('visibility');

// Community plugins.
Bookshelf.plugin(require('bookshelf-paranoia'), {
	field: 'deleted_at',
});
Bookshelf.plugin(require('bookshelf-scopes'));
Bookshelf.plugin(require('bookshelf-eloquent'), {
	withCountSuffix: '_count',
});

// Custom plugins.
const path = require('path');
Bookshelf.plugin(require(path.resolve(__dirname, './helpers/bookshelf-modelbase')));

module.exports = Bookshelf;
