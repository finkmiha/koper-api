'use strict';

const Bookshelf = require('../bookshelf');

require('./work-type');
require('./user');
require('./project');

module.exports = Bookshelf.model('Work', {
	tableName: 'work',

	type: function() {
		return this.belongsTo('WorkType', 'type_id');
	},

	user: function() {
		return this.belongsTo('User', 'user_id');
	},

	project: function() {
		return this.belongsTo('Project', 'project_id');
	},

	/**
	 * Scopes.
	 */

	scopes: {
		isOwner: (q, userId) => q.be.isOwnerScope(userId),
	},
});
