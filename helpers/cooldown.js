'use strict';

const moment = require('moment');
const StateHelper = require('./state');

const COOLDOWNS_LOGIN = require('./cooldowns/login');
const COOLDOWNS_DEFAULT = COOLDOWNS_LOGIN;

/**
 * Helper to throttle attempts.
 *
 * @param {KoaContext} ctx
 * @param {string} key
 */
async function throttleCheck(key, cooldowns = null) {
	if (cooldowns == null) cooldowns = COOLDOWNS_DEFAULT;

	// Check & add the key to the throttling state map.
	let tstate = await StateHelper.get('throttle', key);
	if (tstate != null) {
		let diff = Date.now() - tstate.first_attempt_timestamp;

		// Calc require cooldown from attempt_count.
		let cooldown = cooldowns[cooldowns.length - 1];
		if (tstate.attempt_count <= cooldowns.length) {
			cooldown = cooldowns[tstate.attempt_count - 1];
		}

		// Check if cooldown in effect.
		if (diff < cooldown) {
			let duration = cooldown - diff;
			return duration;
		}

		// Increment the number of attempts.
		tstate.attempt_count++;
		tstate.first_attempt_timestamp = Date.now();
		StateHelper.set('throttle', key, tstate);
	} else {
		StateHelper.set('throttle', key, {
			first_attempt_timestamp: Date.now(),
			attempt_count: 1,
		});
	}
	return null;
}

/**
 * Increment number of attempts.
 *
 * @param {KoaContext} ctx
 * @param {string|string[]} keys Single key or array of keys.
 * @param {integer[]} [cooldowns]
 */
async function attempt(ctx, keys, cooldowns = null) {
	if (cooldowns == null) cooldowns = COOLDOWNS_DEFAULT;

	let max = null;
	for (let key of keys) {
		let duration = await throttleCheck(key, cooldowns);
		if ((duration != null) && (duration > max)) max = duration;
	}

	if (max != null) {
		if (ctx == null) {
			throw new Error(`Cooldown in effect. Please try again in ${moment.duration(max, 'ms').humanize()}.`);
		} else {
			ctx.throw(400, ctx.i18n.__('Cooldown in effect. Please try again in %(humanized)s.', {
				ms: max,
				seconds: Math.ceil(max / 1000),
				humanized: moment.duration(max, 'ms').humanize(),
			}));
		}
	}
}

/**
 * Reset number of attempts.
 *
 * @param {string|string[]} keys Single key or array of keys.
 */
function reset(keys) {
	for (let key of keys) {
		StateHelper.set('throttle', key, null);
	}
}

module.exports = {
	COOLDOWNS_DEFAULT,
	COOLDOWNS_LOGIN,

	attempt,
	reset,
};
