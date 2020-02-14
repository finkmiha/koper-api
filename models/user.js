'use strict';

const Bookshelf = require('../bookshelf');

require('./role');
require('./user-data');
require('./work');

module.exports = Bookshelf.model('User', {
	tableName: 'users',
	hasTimestamps: ['created_at', 'updated_at'],
	hidden: [
		'password',
		'jwt_password_reset_counter',
		'deleted_at',
	],
	softDelete: true,

	// Format data coming from the database.
	parse: function(response) {
		// If (response.is_sms_notify_enabled != null) response.is_sms_notify_enabled = Boolean(response.is_sms_notify_enabled);
		// if (response.is_email_notify_enabled != null) response.is_email_notify_enabled = Boolean(response.is_email_notify_enabled);
		// if (response.is_push_notify_enabled != null) response.is_push_notify_enabled = Boolean(response.is_push_notify_enabled);
		return response;
	},

	/**
	 * Relations.
	 */
	roles: function() {
		return this.belongsToMany('Role', 'user_has_roles', 'user_id', 'role_id');
	},

	data: function() {
		return this.hasMany('UserData', 'user_id');
	},

	work: function() {
		return this.hasMany('Work', 'user_id');
	},

	/**
	 * Scopes.
	 */

	scopes: {
		isMe: (q, userId) => q.be.isOwnerScope(userId, 'id'),
		isAdmin: function(q) {
			// Q.be.whereHas('roles', (subq) => {
			// 	subq.where('name', 'admin');
			// });
		},
	},
});
