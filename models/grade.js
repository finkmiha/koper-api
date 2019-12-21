'use strict';

const Bookshelf = require('../bookshelf');

require('./user');
require('./route');

module.exports = Bookshelf.model('Grade', {
	tableName: 'grades',

	/**
	 * Relations.
	 */
	user:  function() {
		return this.belongsTo('User', 'user_id');
    },
    route:  function() {
		return this.belongsTo('Route', 'route_id');
    },
});
