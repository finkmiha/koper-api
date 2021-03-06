'use strict';

const Joi = require('../helpers/joi-ext');
const Moment = require('moment-timezone');
const MomentRange = require('moment-range');
const momentDurationFormatSetup = require('moment-duration-format');

const moment = MomentRange.extendMoment(Moment);
momentDurationFormatSetup(moment);

const Work = require('../models/work');
const Project = require('../models/project');
const WorkType = require('../models/work-type');
const UserDAO = require('../dao/user');

const groupBy = require('lodash/groupBy');

const Bookshelf = require('../bookshelf');
const knex = Bookshelf.knex;

const generateDatesOfAMonth = () => {
	// Get array of numbers for each day of the month
	let days = [...Array(moment().daysInMonth()).keys()];
	// Create a moment object for each day and format it
	let dayArray = days.map(day => {
	   return { days: moment().date(day + 1).format('YYYY-MM-DD') };
	});
	return dayArray;
};

function arrayUnique(array) {
	let a = array.concat();
	for (let i = 0; i < a.length; ++i) {
		for (let j = i + 1; j < a.length; ++j) {
			if (a[i] === a[j])
				a.splice(j--, 1);
		}
	}

	return a;
}

/**
 * Returns all user work done.
 *
 */
async function showWork(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let work = await Work.where('user_id', user.id).withSelect('type', 'type').withSelect('project', ['name', 'color']).get();
	for (let w of work.models) {
		let daily_work = await UserDAO.dailyWork(ctx, user.id, w.get('day'));
		w.set('daily_work', daily_work);
	}
	// Check if the project was found.
	ctx.assert(work, 400, ctx.i18n.__(`Work for user with id ${user.id} not found.`));
	ctx.body = work;
}

/**
 * Store new work interval.
 *
 * @param {integer} [project_id] Project id.
 * @param {integer} type_id Work type id.
 * @param {string} start Work interval start.
 * @param {string} [end] Work interval end.
 * @param {string} [description] Work description.
 */
async function storeWork(ctx, next) {
	let tz = moment.tz.guess();
	let now = moment.tz(Date.now(), tz).format('HH:mm:ss');
	// Let now = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		project_id: Joi.number().integer(),
		type_id: Joi.number().integer().required(),
		start: Joi.date().required(),
		end: Joi.date().default(now),
		description: Joi.string(),
	}));

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let start = moment.tz(body.start, tz).format('YYYY-MM-DD HH:mm:ss');
	let end = moment.tz(body.end, tz).format('YYYY-MM-DD HH:mm:ss');
	let day = moment.tz(body.start, tz).format('YYYY-MM-DD');
	let time_elapsed = moment(end).diff(start, 'seconds');
	let daily_work = await UserDAO.dailyWork(ctx, user.id, day);

	//Store effective work and handle extra daily hours
	//TODO: Replace hard coded ids
	if (body.type_id === 1) {
		if (daily_work + time_elapsed > 24 * 60 * 60) {
			ctx.throw(400, ctx.i18n.__("Good try, you can't work for more then 24 hours in one day"));
		}
		//If employee work for more than 8 hours store excess hours as extra hours
		if (daily_work > 8 * 60 * 60) {
			let work = new Work({
				user_id: user.id,
				project_id: body.project_id,
				type_id: 4, //TODO: Remove hard coded id (Work_type: extra hours- id).
				start: start,
				end: end,
				day: day,
				time_elapsed: time_elapsed,
				description: body.description,
			});
			await work.save();
		} else if (daily_work + time_elapsed > 8 * 60 * 60) {
			let time = moment.utc(start).add(8 * 60 * 60 - daily_work, 'seconds').format('YYYY-MM-DD HH:mm:ss');
			let workto8hours = new Work({
				user_id: user.id,
				project_id: body.project_id,
				type_id: body.type_id,
				start: start,
				end: time, // End = start + time_elapsed
				day: day,
				time_elapsed: 8 * 60 * 60 - daily_work,
				description: body.description,
			});
			await workto8hours.save();
			// Every second past 8 hours is saved as extra work
			let workafter8hours = new Work({
				user_id: user.id,
				project_id: body.project_id,
				type_id: 4, //TODO: Remove hard coded id (Work_type: extra hours- id).
				start: time, // Start = above ends
				end: end,
				day: day,
				time_elapsed: daily_work + time_elapsed - 8 * 60 * 60,
				description: body.description,
			});
			await workafter8hours.save();
		} else {
			let work = new Work({
				user_id: user.id,
				project_id: body.project_id,
				type_id: body.type_id,
				start: start,
				end: end,
				day: day,
				time_elapsed: time_elapsed,
				description: body.description,
			});
			await work.save();
		}
	} else if (body.type_id === 5) {
		// Store lunch break
		let work = new Work({
			user_id: user.id,
			project_id: body.project_id,
			type_id: body.type_id,
			start: start,
			end: end,
			day: day,
			time_elapsed: time_elapsed,
			description: body.description,
		});
		await work.save();
	} else {
		//Store vacation / sick leave
		//Student vacation/ sick leave has no hours, employee gets 8 hours for vacation day
		//TODO: Check sick leave hours for employees.
		let dayOfWork = 0;
		if (user.type === 'Employee') {
			dayOfWork = 8 * 60 * 60;
		}
		const range = moment.range(moment(start), moment(end));
		const arrayOfDates = Array.from(range.by('day'));

		let dates = arrayOfDates.map(d => moment.utc(d).format('YYYY-MM-DD'));
		for (let date of dates) {
			//Skip weekends when storing sick leave and vacations.
			if (moment.utc(date).day() !== 6 && moment.utc(date).day() !== 0) {
				let work = new Work({
					user_id: user.id,
					project_id: body.project_id,
					type_id: body.type_id,
					start: moment.utc(date).format('YYYY-MM-DD 09:00:00'),
					end: moment.utc(date).format('YYYY-MM-DD 17:00:00'),
					day: date,
					time_elapsed: dayOfWork,
					description: body.description,
				});
				await work.save();
			  }
		}
	}
	ctx.body = 'Work saved.';
}

/**
 * Update work interval.
 *
 * @param {integer} id Work id.
 * @param {integer} [project_id] Project id.
 * @param {integer} [type_id] Work type id.
 * @param {string} [start] Work interval start.
 * @param {string} [end] Work interval end.
 * @param {string} [description] Work description.
 */
async function updateWork(ctx, next) {
	let id = parseInt(ctx.params.id);
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		project_id: Joi.number().integer().default(null),
		type_id: Joi.number().integer().default(null),
		start: Joi.date().default(null),
		end: Joi.date().default(null),
		description: Joi.string().default(null),
	}));

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let work = await Work.where('id', id).where('user_id', user.id).first();

	// Check if the project was found.
	ctx.assert(work, 400, ctx.i18n.__(`Work with id ${id} for user ${user.id} not found.`));

	// Update the project.
	if (body.project_id !== null) work.set('project_id', body.project_id);
	if (body.type_id !== null) work.set('type_id', body.type_id);
	if (body.start !== null) {
		let start = moment.utc(body.start).format('YYYY-MM-DD HH:mm:ss');
		let day = moment.utc(body.start).format('YYYY-MM-DD');
		work.set('start', start);
		work.set('day', day);
	}
	if (body.end !== null) {
		let end = moment.utc(body.end).format('YYYY-MM-DD HH:mm:ss');
		work.set('end', end);
	}
	if (body.description !== null) work.set('description', body.description);

	// Update elapsed time before work save.
	if (body.start !== null || body.end !== null) {
		let start = moment.utc(body.start).format('YYYY-MM-DD HH:mm:ss');
		let end = moment.utc(body.end).format('YYYY-MM-DD HH:mm:ss');
		let dif = moment(end).diff(start, 'seconds');
		work.set('time_elapsed', dif);
	}
	// Save the new project.
	await work.save();
	ctx.body = `Work with id ${id} updated.`;
}

/**
 * Delete work interval.
 *
 * @param {integer} id Work id.
 */
async function deleteWork(ctx, next) {
	let id = parseInt(ctx.params.id);

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let work = await Work.where('id', id).where('user_id', user.id).first();

	// Check if the project was found.
	ctx.assert(work, 400, ctx.i18n.__(`Work with id ${id} for user ${user.id} not found.`));

	await work.delete();
	ctx.body = `Work with id ${id} for user ${user.id} deleted.`;
}

/**
 * Get daily work done.
 *
 * @param {string} day Day of work.
 */
async function dailyWork(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		day: Joi.date().required(),
	}));

	let day = moment.utc(body.day).format('YYYY-MM-DD');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);

	let time_elapsed = await UserDAO.dailyWork(ctx, user.id, day);

	ctx.body = `Daily work: ${time_elapsed} seconds.`;
}

/**
 * Get monthly work.
 *
 * @param {integer} month Day of work.
 */
async function monthlyWork(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		month: Joi.integer().required(),
	}));

	let day = moment.utc(body.day).format('YYYY-MM-DD');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let dailyWork = await Work.where('day', day).where('user_id', user.id).get();

	let time_elapsed = 0;

	for (let dw of dailyWork.models) {
		time_elapsed += dw.get('time_elapsed');
	}

	// Check if the project was found.
	ctx.assert(dailyWork, 400, ctx.i18n.__(`Work for user ${user.id} on ${day} not found.`));

	ctx.body = `Daily work: ${time_elapsed} seconds.`;
}

/**
 * Get users work history for a specific project.
 *
 * @param {integer[]} project_ids Project id.
 */
async function projectWork(ctx, next) {
	let body = Joi.attempt(ctx.request.body, Joi.object().keys({
		project_ids: Joi.array().items(Joi.number().integer()).single().default([]),
	}));
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let projects = await Project.select(['id', 'name', 'color']).whereIn('id', body.project_ids).get();
	let projectNames = [];
	let chartData = [];
	let dates = [];
	dates = generateDatesOfAMonth();
	dates = dates.map(d => d.days);

	// Cut future days
	let cutIndex = dates.indexOf(moment.utc().format('YYYY-MM-DD'));
	dates = dates.slice(0, cutIndex + 1);

	for (let project of projects.models) {
		let projectName = project.get('name');
		let projectId = project.get('id');
		let projectColor = project.get('color');
		projectNames.push(projectName);

		let data = await Work.query().select('day', knex.raw('SUM(time_elapsed) AS seconds')).where('user_id', user.id).where('project_id', projectId).groupBy('day');

		let labels = [];
		let series = new Array(dates.length).fill(0);
		for (let d of data) {
			let dayOfMonth = dates.indexOf(d.day);
			labels.push(d.day);
			series[dayOfMonth] = (d.seconds / 3600).toFixed(2);
		}
		// Dates = arrayUnique(dates.concat(labels));

		let projectWork = {
			projectId,
			projectName,
			projectColor,
			labels,
			series,
		};
		chartData.push(projectWork);
	}

	dates = dates.map(d => moment.utc(d).format('DD-MM'));
	ctx.body = { dates,
		chartData };
}

/**
 * Get users all time work statistics.
 *
 */
async function allTimeWorkStats(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);

	let vacation = await WorkType.select('id').where('type', 'Vacation').first();
	let vacation_id = vacation.get('id');

	let sick_leave = await WorkType.select('id').where('type', 'Sick leave').first();
	let sick_leave_id = sick_leave.get('id');

	let work_types = await WorkType.select('id').whereNotIn('type', ['Vacation', 'Sick leave']).get();
	let work_type_ids = [];
	for (let wt of work_types.models) {
		work_type_ids.push(wt.get('id'));
	}

	let work_data = await Work.select('time_elapsed').where('user_id', user.id).whereIn('type_id', work_type_ids).get();
	let hours = [];
	let monthly_hours = 0;
	for (let wd of work_data.models) {
		hours.push(wd.get('time_elapsed'));
		monthly_hours += wd.get('time_elapsed');
	}

	let vacation_data = await Work.select('time_elapsed').where('user_id', user.id).where('type_id', vacation_id).get();
	let vacation_hours = 0;
	for (let vd of vacation_data.models) {
		vacation_hours += vd.get('time_elapsed');
	}

	let sick_leave_data = await Work.select('time_elapsed').where('user_id', user.id).where('type_id', sick_leave_id).get();
	let sick_leave_hours = 0;
	for (let sld of sick_leave_data.models) {
		sick_leave_hours += sld.get('time_elapsed');
	}

	monthly_hours = moment.duration(monthly_hours, 'seconds').format('h [h] m [min] s [sec]');
	vacation_hours = moment.duration(vacation_hours, 'seconds').format('h [h] m [min] s [sec]');
	sick_leave_hours = moment.duration(sick_leave_hours, 'seconds').format('h [h] m [min] s [sec]');

	ctx.body = {
		monthly_hours,
		vacation_hours,
		sick_leave_hours,
	};
}

/**
 * Get users mothly work statistics.
 *
 */
async function monthlyWorkStats(ctx, next) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let month = moment.utc().format('YYYY-MM');

	let vacation = await WorkType.select('id').where('type', 'Vacation').first();
	let vacation_id = vacation.get('id');

	let sick_leave = await WorkType.select('id').where('type', 'Sick leave').first();
	let sick_leave_id = sick_leave.get('id');

	let work_types = await WorkType.select('id').whereNotIn('type', ['Vacation', 'Sick leave']).get();
	let work_type_ids = [];
	for (let wt of work_types.models) {
		work_type_ids.push(wt.get('id'));
	}
	let dates = [];
	dates = generateDatesOfAMonth();
	dates = dates.map(d => d.days);
	// Cut future days
	let cutIndex = dates.indexOf(moment.utc().format('YYYY-MM-DD'));
	dates = dates.slice(0, cutIndex + 1);
	// Remove weekends
	dates = dates.filter(date => moment.utc(date).day() !== 6 && moment.utc(date).day() !== 0);

	let should_have_worked = dates.length * 8 * 60 * 60;
	let work_data = await Work.select('time_elapsed').where('user_id', user.id).whereIn('type_id', work_type_ids).where('day', 'like', `${month}%`).get();
	let hours = [];
	let monthly_hours = 0;
	for (let wd of work_data.models) {
		hours.push(wd.get('time_elapsed'));
		monthly_hours += wd.get('time_elapsed');
	}

	let vacation_data = await Work.select('time_elapsed').where('user_id', user.id).where('type_id', vacation_id).where('day', 'like', `${month}%`).get();
	let vacation_hours = 0;
	for (let vd of vacation_data.models) {
		vacation_hours += vd.get('time_elapsed');
	}

	let sick_leave_data = await Work.select('time_elapsed').where('user_id', user.id).where('type_id', sick_leave_id).where('day', 'like', `${month}%`).get();
	let sick_leave_hours = 0;
	for (let sld of sick_leave_data.models) {
		sick_leave_hours += sld.get('time_elapsed');
	}

	let text = '';
	let difference = monthly_hours - should_have_worked;
	let schedule = moment.duration(Math.abs(difference), 'seconds').format('d [day] h [h] m [min] s [sec]');
	if (difference >= 0) {
		text = `You are ${schedule} ahead of schedule.`;
	} else {
		text = `You are ${schedule} behind schedule.`;
	}
	should_have_worked = moment.duration(should_have_worked, 'seconds').format('h [h] m [min] s [sec]');
	monthly_hours = moment.duration(monthly_hours, 'seconds').format('h [h] m [min] s [sec]');
	vacation_hours = moment.duration(vacation_hours, 'seconds').format('h [h] m [min] s [sec]');
	sick_leave_hours = moment.duration(sick_leave_hours, 'seconds').format('h [h] m [min] s [sec]');

	ctx.body = {
		should_have_worked,
		monthly_hours,
		vacation_hours,
		sick_leave_hours,
		schedule_text: text,
	};
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	showWork,
	storeWork,
	updateWork,
	deleteWork,
	dailyWork,
	projectWork,
	allTimeWorkStats,
	monthlyWorkStats,
};
