'use strict';

const Bookshelf = require('../bookshelf');

require('./location');
require('./grade');

module.exports = Bookshelf.model('Route', {
    tableName: 'routes',
    hasTimestamps: ['created_at', 'updated_at'],
	hidden: [
		'deleted_at',
	],
	softDelete: true,

	/**
	 * Relations.
	 */

	location:  function() {
		return this.belongsTo('Location', 'location_id');
    },
    grades: function() {
		return this.hasMany('Grade', 'route_id');
	},
});
