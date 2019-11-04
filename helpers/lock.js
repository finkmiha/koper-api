'use strict';

const Log = require('unklogger');
const isFunction = require('lodash/isFunction');
const isAsync = require('../helpers/isAsync');
const AsyncLock = require('async-lock');
const GLOBAL_LOCK = new AsyncLock();

function logError(tag, error) {
	Log.error(tag, error.message);
	if (process.env.NODE_ENV === 'development') {
		console.error(error);
		if (error.stack) {
			console.error(error.stack);
		}
	} else if (error.stack) {
		let lines = error.stack.split(/\r?\n/);
		let lnCount = lines.length;
		lines = lines.slice(0, 3);
		if (lnCount > 3) {
			lines.push('    ...');
		}
		console.error(lines.join('\n'));
	}
}

/**
 * Lock a critical section of code.
 * Only one thread (stack trace) can access this part of the code at a time.
 *
 * @param {function} fn
 * @param {mixed} [keys=null]
 * @param {boolean} [suppressErrors=false]
 */
function lockify(fn, keys = null, suppressErrors = false) {
	// Force functions to be async to avoid confusion.
	if (!isAsync(fn)) throw new Error('Locked functions need to be async.');

	let lockSpace = GLOBAL_LOCK;
	let isKeysFn = false;
	let isKeysAsyncFn = false;
	if (keys == null) {
		keys = 'keys';
		lockSpace = new AsyncLock();
	} else if (isFunction(keys)) {
		isKeysFn = true;
		isKeysAsyncFn = isAsync(keys);
	}

	let lockWrapFn = async function(...args) {
		// eslint-disable-next-line no-undef-init, no-undefined
		let retVal = undefined;
		try {
			let ckeys = keys;
			if (isKeysFn) {
				if (isKeysAsyncFn) ckeys = await keys(...args);
				else ckeys = keys(...args);
			}
			await lockSpace.acquire(ckeys, async () => {
				retVal = await fn(...args);
			});
		} catch (error) {
			if (suppressErrors) logError('LOCKIFIED JOB FAILED', error);
			else throw error;
		}
		return retVal;
	};

	return lockWrapFn;
}

module.exports = {
	lock: GLOBAL_LOCK,
	lockify,
};
