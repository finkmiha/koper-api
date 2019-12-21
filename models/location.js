'use strict';

const Bookshelf = require('../bookshelf');

require('./region');
require('./route');

module.exports = Bookshelf.model('Location', {
    tableName: 'locations',
    hasTimestamps: ['created_at', 'updated_at'],
	hidden: [
		'deleted_at',
	],
	softDelete: true,

	/**
	 * Relations.
	 */

	region:  function() {
		return this.belongsTo('Region', 'region_id');
    },
    routes: function() {
		return this.hasMany('Route', 'location_id');
	},
});
