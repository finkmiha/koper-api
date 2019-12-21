'use strict';

const Bookshelf = require('../bookshelf');
const isOwnerScope = require('../helpers/is-owner-scope');

require('./role');
require('./grade');

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
	grades: function() {
		return this.hasMany('Grade', 'user_id');
	},

	/**
	 * Scopes.
	 */

	scopes: {
		isMe: (q, userId) => isOwnerScope(q, userId, 'id'),
		isAdmin: function(q) {
			// Q.be.whereHas('roles', (subq) => {
			// 	subq.where('name', 'admin');
			// });
		},
	},
});
