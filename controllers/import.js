'use strict';

const moment = require('moment-timezone');
const Joi = require('../helpers/joi-ext');
const isNonEmptyString = require('../helpers/is-non-empty-string');
const TimezoneHelper = require('../helpers/timezone');

const Work = require('../models/work');
const WorkType = require('../models/work-type');
const Project = require('../models/project');

const TYPE_MAP = new Map();
TYPE_MAP.set('work', 'work');
TYPE_MAP.set('effective work', 'work');
TYPE_MAP.set('extra hours', 'extra hours');
TYPE_MAP.set('break', 'break');
TYPE_MAP.set('lunch break', 'break');
TYPE_MAP.set('sick leave', 'sick leave');
TYPE_MAP.set('vacation', 'vacation');
TYPE_MAP.set('holiday', 'holiday');
TYPE_MAP.set('use of hours', 'use of hours');

function formatInterval(ctx, interval, timezone = null) {
	if (timezone == null) timezone = TimezoneHelper.DEFAULT_TIMEZONE;

	let type = interval.type;
	if (!TYPE_MAP.has(type)) ctx.throw(400, `Invalid type "${interval.type}".`);
	type = TYPE_MAP.get(type);

	if (['work', 'extra hours', 'break'].includes(type)) {
		if (interval.from == null) ctx.throw(400, 'Interval is missing the from time.');
		if (interval.to == null) ctx.throw(400, 'Interval is missing the to time.');

		let date = interval.date;
		if (date != null) {
			date = moment.tz(date, 'YYYY-MM-DD', timezone);
			if (!date.isValid()) ctx.throw(400, `Invalid date "${interval.date}".`);
			date = date.format('YYYY-MM-DD');
		} else {
			date = interval.from.clone().tz(timezone).format('YYYY-MM-DD'); // TODO: test timezone cast
		}

		return {
			type: type,
			from: interval.from.clone().tz('UTC').format('YYYY-MM-DD HH:mm:ss'),
			to: interval.to.clone().tz('UTC').format('YYYY-MM-DD HH:mm:ss'),
			date: date,
			tag: interval.tag || null,
			texts: interval.texts || [],
		};
	} else if (['sick leave', 'vacation', 'holiday', 'use of hours'].includes(type)) {
		let date = interval.date;
		if (date != null) {
			date = moment.tz(date, 'YYYY-MM-DD', timezone);
			if (!date.isValid()) ctx.throw(400, `Invalid date "${interval.date}".`);
			date = date.format('YYYY-MM-DD');
		} else if (interval.from != null) {
			date = interval.from.clone().tz(timezone).format('YYYY-MM-DD'); // TODO: test timezone cast
		} else if (interval.to != null) {
			date = interval.to.clone().tz(timezone).format('YYYY-MM-DD'); // TODO: test timezone cast
		} else ctx.throw(400, 'Interval is missing the date.');

		let from = moment.tz(`${date} 09:00:00`, 'YYYY-MM-DD HH:mm:ss', timezone);
		let to = moment.tz(`${date} 17:00:00`, 'YYYY-MM-DD HH:mm:ss', timezone);

		return {
			type: type,
			from: from.tz('UTC').format('YYYY-MM-DD HH:mm:ss'), // TODO: test timezone cast
			to: to.tz('UTC').format('YYYY-MM-DD HH:mm:ss'), // TODO: test timezone cast
			date: date,
			tag: interval.tag || null,
			texts: interval.texts || [],
		};
	} else ctx.throw(400, `Invalid type "${interval.type}".`);
	// NOTE: This should never happen.
	return null;
}

async function resolveWorkTypes(ctx, intervals) {
	let names = Array.from(new Set(intervals.map(i => i.type).filter(name => (name != null))));
	let wTypes = await WorkType.select(['id', 'type']).whereIn('type', names).get();
	wTypes = wTypes.toJSON();
	let map = new Map();
	for (let wt of wTypes) map.set(wt.type.toLowerCase(), wt.id);
	for (let name of names) {
		if (!map.has(name)) ctx.throw(400, `Work type "${name}" does not exist in the database.`);
	}
	return map;
}

async function resolveProjectTags(ctx, intervals) {
	let names = Array.from(new Set(intervals.map(i => i.tag).filter(name => (name != null))));
	let tags = await Project.select(['id', 'tag']).whereIn('tag', names).get();
	tags = tags.toJSON();
	let map = new Map();
	for (let tag of tags) map.set(tag.tag.toLowerCase(), tag.id);
	for (let name of names) {
		if (!map.has(name)) ctx.throw(400, `Project tag "${name}" does not exist in the database.`);
	}
	return map;
}

async function clearPreviousIntervalsHelper(ctx, intervals, timezone) {
	if (intervals.length < 1) return 0;
	let minDate = moment.tz(intervals[0].date, 'YYYY-MM-DD', timezone);
	let maxDate = minDate.clone();
	for (let i of intervals) {
		let date = moment.tz(i.date, 'YYYY-MM-DD', timezone);
		if (date.isBefore(minDate)) minDate = date.clone();
		if (date.isAfter(maxDate)) maxDate = date.clone();
	}

	let days = [];
	while (minDate.isSameOrBefore(maxDate)) {
		days.push(minDate.format('YYYY-MM-DD'));
		minDate = minDate.add(1, 'day');
	}

	let deletedCount = 0;
	if (days.length > 0) {
		let ctime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
		deletedCount = await Work.isOwner(ctx).whereIn('day', days).query().whereNull('deleted_at').update({ deleted_at: ctime });
	}
	return deletedCount;
}

async function storeBulkHelper(ctx, intervals, timezone = null, clearPreviousIntervals = false) {
	if (timezone == null) timezone = TimezoneHelper.DEFAULT_TIMEZONE;
	let wtMap = await resolveWorkTypes(ctx, intervals);
	let ptMap = await resolveProjectTags(ctx, intervals);

	let deletedCount = 0;
	if (clearPreviousIntervals) deletedCount = await clearPreviousIntervalsHelper(ctx, intervals, timezone);

	let col = Work.collection();
	let ctime = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	for (let i of intervals) {
		let timeElapsed = moment.utc(i.to).diff(moment.utc(i.from), 'seconds');
		col.add({
			user_id: ctx.state.user.id,
			project_id: (i.tag != null) ? ptMap.get(i.tag) : null,
			type_id: (i.type != null) ? wtMap.get(i.type) : null,
			start: i.from,
			end: i.to,
			day: i.date,
			time_elapsed: timeElapsed,
			description: i.texts.filter(t => isNonEmptyString(t)).map(t => t.trim()).join(', '),
			created_at: ctime,
			updated_at: ctime,
		});
	}
	if (col.length > 0) await col.insert();

	return {
		inserted_count: col.length,
		deleted_count: deletedCount,
	};
}

/**
 * Import a single work interval.
 *
 * @param {string} [timezone] On frontend you can use the moment.tz.guess(true); to get the browser's timezone - check out the moment-timezone docs at https://momentjs.com/timezone/docs/#/use-it/
 * @param {string} type Work type. Can be "work", "effective work", "extra hours", "break", "lunch break", "sick leave", "vacation", "holiday" or "use of hours".
 * @param {number|string} [from] DateTime string in UTC parsable by moment.js or UNIX seconds since epoch.
 * @param {number|string} [to] DateTime string in UTC parsable by moment.js or UNIX seconds since epoch.
 * @param {string} [date] Date in format YYYY-MM-DD.
 * @param {string} [tag] Project tag.
 * @param {string|string[]} [texts] Interval description texts.
 * @param {boolean} [clear_previous_intervals] Clear any previous intervals in the given date range.
 */
async function store(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		timezone: Joi.string().valid(TimezoneHelper.getTimezoneValues()).allow(null).default(null).error(() => 'Invalid timezone value.'),
		type: Joi.string().lowercase().trim().valid(['work', 'effective work', 'extra hours', 'break', 'lunch break', 'sick leave', 'vacation', 'holiday', 'use of hours']).required(),
		from: Joi.moment().allow(null),
		to: Joi.moment().allow(null),
		date: Joi.string().trim().allow(null),
		tag: Joi.string().lowercase().trim().allow(null),
		texts: Joi.array().items(Joi.string()).single().allow([]).default([]),
		clear_previous_intervals: Joi.boolean().default(false),
	}));

	let interval = formatInterval(ctx, body, body.timezone);
	let result = await storeBulkHelper(ctx, [interval], body.timezone, body.clear_previous_intervals);
	ctx.body = result;
}

/**
 * Bulk import work intervals.
 *
 * @param {string} [timezone] On frontend you can use the moment.tz.guess(true); to get the browser's timezone - check out the moment-timezone docs at https://momentjs.com/timezone/docs/#/use-it/
 * @param {object[]} intervals Array of interval objects in the specified format.
 * @param {boolean} [clear_previous_intervals] Clear any previous intervals in the given date range.
 */
async function storeBulk(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		timezone: Joi.string().valid(TimezoneHelper.getTimezoneValues()).allow(null).default(null).error(() => 'Invalid timezone value.'),
		intervals: Joi.array().items(Joi.object().keys({
			type: Joi.string().lowercase().trim().valid(['work', 'effective work', 'extra hours', 'break', 'lunch break', 'sick leave', 'vacation', 'holiday', 'use of hours']).required(),
			from: Joi.moment().allow(null),
			to: Joi.moment().allow(null),
			date: Joi.string().trim().allow(null),
			tag: Joi.string().lowercase().trim().allow(null),
			texts: Joi.array().items(Joi.string()).single().allow([]).default([]),
		})),
		clear_previous_intervals: Joi.boolean().default(false),
	}));

	let intervals = body.intervals.map(i => formatInterval(ctx, i, body.timezone));
	let result = await storeBulkHelper(ctx, intervals, body.timezone, body.clear_previous_intervals);
	ctx.body = result;
}

module.exports = {
	store,
	storeBulk,
};
