'use strict';

const Bookshelf = require('../bookshelf');

module.exports = Bookshelf.model('State', {
	tableName: 'state',
	hasTimestamps: ['created_at', 'updated_at'],
	hidden: ['deleted_at'],
	softDelete: true,
});
