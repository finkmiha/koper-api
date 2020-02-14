'use strict';

const moment = require('moment');
const Bookshelf = require('../bookshelf');

require('./user');

module.exports = Bookshelf.model('UserData', {
	tableName: 'user_data',
	hasTimestamps: ['createdAt', 'updatedAt'],
	hidden: ['deletedAt'],
	softDelete: true,

	user: function() {
		return this.belongsTo('User', 'user_id');
	},

	// Use for user statistics.
	scopes: {
		history: function(q, fromDate, toDate) {
			q.be.where((wq) => {
				wq.where('createdAt', '<=', moment.utc(toDate).format('YYYY-MM-DD HH:mm:ss'));
				wq.where((swq) => {
					swq.whereNull('deletedAt');
					swq.orWhere('deletedAt', '>', moment.utc(fromDate).format('YYYY-MM-DD HH:mm:ss'));
				});
			});
			q.be.withDeleted();
		},
	},
});
