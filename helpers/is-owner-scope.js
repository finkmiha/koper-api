'use strict';

const get = require('lodash/get');
const isInteger = require('lodash/isInteger');

function isOwner(q, userId, attr = 'user_id') {
	if (!isInteger(userId)) {
		userId = get(userId, 'state.user.id', null);
	}
	if (isInteger(userId)) {
		q.be.where(attr, userId);
	} else {
		// Select none.
		q.be.where('id', '<', 0);
		q.be.where('id', '>', 0);
	}
}

module.exports = isOwner;
