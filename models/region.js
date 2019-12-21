'use strict';

const Bookshelf = require('../bookshelf');

require('./location');

module.exports = Bookshelf.model('Region', {
	tableName: 'regions',

	/**
	 * Relations.
	 */
	locations: function() {
		return this.hasMany('Location', 'region_id');
	},
});
