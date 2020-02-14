'use strict';

const Bookshelf = require('../bookshelf');

require('./work');

module.exports = Bookshelf.model('WorkType', {
	tableName: 'work_types',

	data: function() {
		return this.hasMany('Work', 'type_id');
	},
});
