'use strict';

const moment = require('moment');
const Bookshelf = require('../bookshelf');

require('./user');

module.exports = Bookshelf.model('ApiKey', {
	tableName: 'api_keys',
	hasTimestamps: ['created_at', 'updated_at'],
	hidden: ['key', 'deleted_at'],
	softDelete: true,

	// Format data coming from the database.
	parse: function(response) {
		if (response.enabled != null) response.enabled = Boolean(response.enabled);
		return response;
	},

	user: function() {
		return this.belongsTo('User', 'user_id');
	},

	/**
	 * Scopes.
	 */

	scopes: {
		isOwner: (q, userId) => q.be.isOwnerScope(userId),

		isEnabled: function(q) {
			q.be.where('enabled', true);
		},
		isDisabled: function(q) {
			q.be.where('enabled', false);
		},

		isExpired: function(q) {
			let ctime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
			q.be.where((wq) => {
				wq.whereNotNull('expires_at');
				wq.where('expires_at', '<', ctime);
			});
		},
		isValid: function(q) {
			let ctime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
			q.be.isEnabled();
			q.be.where((wq) => {
				wq.whereNull('expires_at');
				wq.orWhere('expires_at', '>=', ctime);
			});
		},
	},
});
