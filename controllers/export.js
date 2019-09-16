'use strict';

const Joi = require('../helpers/joi-ext');
const xlsx = require('node-xlsx');
const fs = require('fs');
const UserDAO = require('../dao/user');

const Moment = require('moment');
const MomentRange = require('moment-range');
const momentDurationFormatSetup = require('moment-duration-format');

const moment = MomentRange.extendMoment(Moment);
momentDurationFormatSetup(moment);

const Work = require('../models/work');

//  * @param {integer} [project_id] Project id.
//  * @param {integer} type_id Work type id.
//  * @param {string} start Work interval start.
//  * @param {string} [end] Work interval end.
//  * @param {string} [description] Work description.

/**
 * Export user work to excel spreadsheet.
 *
 */
async function exportMyWork(ctx, next) {
	// let now = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let month = moment.utc().format('YYYY-MM');
	// let month = "2019-08";
	// let body = Joi.validate(ctx.request.body, Joi.object().keys({
	// 	project_id: Joi.number().integer(),
	// 	type_id: Joi.number().integer().required(),
	// 	start: Joi.date().required(),
	// 	end: Joi.date().default(now),
	// 	description: Joi.string(),s
	// }));
	let work_data = await Work.where('user_id', user.id).where('day', 'like', `${month}%`).withSelect('project','name').withSelect('type', 'type').get();
	let work = {};
	for (let interval of work_data.models) {
		interval = interval.toJSON();
		let type = interval.type.type;
		let day = interval.day;

		let start = moment.utc(interval.start).format('HH:mm:ss');
		let end = moment.utc(interval.end).format('HH:mm:ss');
		let description = interval.description;
		let time_elapsed = interval.time_elapsed;

		if (Object.keys(work).includes(day)) {
			if (type == "Extra hours" || type == "Effective work") {
				work[day].work_start.push(start);
				work[day].work_end.push(end);
				work[day].work_done += time_elapsed;
				work[day].description.push(description);
				if (interval.project !== null) {
					work[day].projects.push(interval.project.name);
				}
			}
			else if (type == "Lunch break") {
				work[day].lunch_start.push(start);
				work[day].lunch_end.push(end);
			}

		}
		else {
			if (type == "Extra hours" || type == "Effective work") {
				work[day] = {
					work_start: [start],
					work_end: [end],
					work_done: time_elapsed,
					lunch_start: [],
					lunch_end: [],
					description: [description],
					projects: []
				}
				if (interval.project !== null) {
					work[day].projects.push(interval.project.name);
				}
			}
			else if (type == "Lunch break") {
				work[day] = {
					work_start: [],
					work_end: [],
					work_done: 0,
					lunch_start: [start],
					lunch_end: [end],
					description: [description],
					projects: []
				}
			}
		}
	}
	let data = [["Day", "Start", "End", "Intervals", "Lunch", "Work done", "Projects", "Description"]];

	let days = Object.keys(work)
	for( let day of days) {
		let work_intervals = [];
		for (let i = 0; i < work[day].work_end.length; i++) {
			work_intervals.push(`${work[day].work_start[i]} - ${work[day].work_end[i]}`);
		}
		work[day].work_intervals = work_intervals.join(', ');

		// Get only starting time and end time from work intervals
		let min = work[day].work_start.reduce((min, start) => start < min ? start : min, work[day].work_start[0]);
		let max = work[day].work_end.reduce((max, end) => end > max ? end : max, work[day].work_end[0]);
		work[day].work_start = min;
		work[day].work_end = max;
		work[day].description = work[day].description.filter(d => d !== null).join(' ');
		work[day].projects = work[day].projects.filter(p => p !== null).join(', ');
		work[day].work_done = moment.duration(work[day].work_done, "seconds").format("h [h] m [min] s [sec]");

		let lunch = [];
		for (let i = 0; i < work[day].lunch_end.length; i++) {
			lunch.push(`${work[day].lunch_start[i]} - ${work[day].lunch_end[i]}`);
		}
		work[day].lunch_intervals = lunch.join(', ');
		delete work[day].lunch_end;
		delete work[day].lunch_start;

		let daily_data = [day, work[day].work_start, work[day].work_end, work[day].work_intervals, work[day].lunch_intervals, work[day].work_done, work[day].projects, work[day].description];
		data.push(daily_data);
	}

	let spreadsheets = [{name: user.name, data: data}]
	let buffer = xlsx.build(spreadsheets);


	// fs.writeFileSync(`Hours.xlsx`, buffer)
	// ctx.attachment("Hours.xlsx");
	// ctx.body = fs.createReadStream("Hours.xlsx");

	ctx.set('Content-disposition', 'attachment; filename=Hours.xlsx');
	ctx.set('Content-type', 'file/xlsx');
	ctx.body = buffer;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	exportMyWork
};
