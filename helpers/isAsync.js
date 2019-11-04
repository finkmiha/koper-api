'use strict';

// Check if fn is an async function.
// Source: https://github.com/tc39/ecmascript-asyncawait/issues/78
function isAsync(fn) {
	if (fn == null) {
		return false;
	}
	if (fn.constructor == null) {
		return false;
	}
	return fn.constructor.name === 'AsyncFunction';
}

module.exports = isAsync;
