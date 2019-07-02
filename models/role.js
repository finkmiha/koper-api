'use strict';

const Bookshelf = require('../bookshelf');

require('./user');

module.exports = Bookshelf.model('Role', {
	tableName: 'roles',

	/**
	 * Relations.
	 */

	users: function() {
		return this.belongsToMany('User', 'user_has_roles', 'role_id', 'user_id');
	},
});
