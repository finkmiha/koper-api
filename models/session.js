'use strict';

const Bookshelf = require('../bookshelf');

const moment = require('moment');

require('./user');

module.exports = Bookshelf.model('Session', {
	tableName: 'sessions',
	hasTimestamps: ['created_at', 'updated_at'],
	hidden: [
		'key',
	],

	// Format data coming from the database.
	parse: function(response) {
		if (response.data != null) {
			response.data = JSON.parse(response.data);
		}
		return response;
	},

	/**
	 * Relations.
	 */

	user: function() {
		return this.belongsTo('User', 'user_id');
	},

	/**
	 * Scopes.
	 */

	scopes: {
		isExpired: function(q) {
			let ctime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
			q.be.where((wq) => {
				wq.whereNotNull('expires_at');
				wq.where('expires_at', '<', ctime);
			});
		},
		isValid: function(q) {
			let ctime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
			q.be.where((wq) => {
				wq.whereNull('expires_at');
				wq.orWhere('expires_at', '>=', ctime);
			});
		},
	},
});
