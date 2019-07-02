'use strict';

const Bookshelf = require('../bookshelf');

require('./work');

module.exports = Bookshelf.model('Project', {
	tableName: 'project',
	hasTimestamps: ['created_at', 'updated_at'],

	work: function() {
		return this.hasMany('Work', 'project_id');
	},
});
