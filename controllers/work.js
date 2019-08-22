'use strict';

const Joi = require('../helpers/joi-ext');
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);

const Work = require('../models/work');
const Project = require('../models/project');
const WorkType = require('../models/work-type');
const UserDAO = require('../dao/user');

const groupBy = require("lodash/groupBy");

const Bookshelf = require("../bookshelf");
const knex = Bookshelf.knex;

const generateDatesOfAMonth = () => {
	// Get array of numbers for each day of the month
	let days = [...Array(moment().daysInMonth()).keys()];
	// Create a moment object for each day and format it
	let dayArray = days.map( day => {
	   return { days: moment().date(day+1).format('YYYY-MM-DD') }
	});
	return dayArray;
}

function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
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
	let work = await Work.where('user_id', user.id).withSelect('type', 'type').withSelect('project', 'name').get();

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
	let now = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		project_id: Joi.number().integer(),
		type_id: Joi.number().integer().required(),
		start: Joi.date().required(),
		end: Joi.date().default(now),
		description: Joi.string(),
	}));

	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let start = moment.utc(body.start).add(2, 'hours').format('YYYY-MM-DD HH:mm:ss');
	let end = moment.utc(body.end).add(2, 'hours').format('YYYY-MM-DD HH:mm:ss');
	let day = moment.utc(body.start).add(2, 'hours').format('YYYY-MM-DD');
	let time_elapsed = moment(end).diff(start, 'seconds');
	let daily_work = await UserDAO.dailyWork(ctx, user.id, day);

	//Store effective work and handle extra daily hours
	if (body.type_id === 1) {
		if (daily_work + time_elapsed > 24*60*60 ) {
			ctx.throw(400, ctx.i18n.__("Good try, you can't work for more then 24 hours in one day"));
		}
		//If employee work for more than 8 hours store excess hours as extra hours
		if ( daily_work > 8*60*60 ) {
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
		}
		else if ( daily_work + time_elapsed > 8*60*60 ) {
			let time = moment.utc(start).add(8*60*60 - daily_work, 'seconds').format('YYYY-MM-DD HH:mm:ss');
			let workto8hours = new Work({
				user_id: user.id,
				project_id: body.project_id,
				type_id: body.type_id,
				start: start,
				end: time,  // end = start + time_elapsed
				day: day,
				time_elapsed: 8*60*60 - daily_work,
				description: body.description,
			});
			await workto8hours.save();
			// Every second past 8 hours is saved as extra work
			let workafter8hours = new Work({
				user_id: user.id,
				project_id: body.project_id,
				type_id: 4,  //TODO: Remove hard coded id (Work_type: extra hours- id).
				start: time,  // start = above ends
				end: end,
				day: day,
				time_elapsed: daily_work + time_elapsed - 8*60*60,
				description: body.description,
			});
			await workafter8hours.save();
		}
		else {
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
	}
	//Store vacation / sick leave (TODO: Student vacation/ sick leave has no hours, employee gets 8 hours for vacation day)
	else {
		//8hours in seconds (employee vacation insert)
		let dayOfWork = 8*60*60;

		const range = moment.range(moment(start), moment(end));
		const arrayOfDates = Array.from(range.by('day'))

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
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
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
		let day = moment.utc(body.start).format('YYYY-MM-DD')
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
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
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
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		month: Joi.integer().required(),
	}));

	let day = moment.utc(body.day).format('YYYY-MM-DD');
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let dailyWork = await Work.where('day', day).where('user_id', user.id).get();

	let time_elapsed = 0;

	for (let dw of dailyWork.models) {
		time_elapsed = time_elapsed + dw.get('time_elapsed');
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
	let body = Joi.validate(ctx.request.body, Joi.object().keys({
		project_ids: Joi.array().items(Joi.number().integer()).single().default([]),
	}));
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	let projects = await Project.select(['id','name','color']).whereIn('id', body.project_ids).get();
	let projectNames = [];
	let chartData = [];
	let dates = [];
	dates = generateDatesOfAMonth();
	dates = dates.map(d => d.days);

	// Cut future days
	let cutIndex = dates.indexOf(moment.utc().format('YYYY-MM-DD'));
	dates = dates.slice(0,cutIndex+1)

	for (let project of projects.models) {
		let projectName = project.get('name');
		let projectId = project.get('id');
		let projectColor = project.get('color');
		projectNames.push(projectName);

		let data = await Work.query().select('day', knex.raw('SUM(time_elapsed) AS seconds')).where('user_id', user.id).where('project_id', projectId).groupBy('day');

		let labels = [];
		let series = new Array(dates.length).fill(0);
		for (let d of data){
			let dayOfMonth = dates.indexOf(d.day);
			labels.push(d.day);
			series[dayOfMonth] = (d.seconds/3600).toFixed(2);
		}
		// dates = arrayUnique(dates.concat(labels));


		let projectWork = {
			projectId,
			projectName,
			projectColor,
			labels,
			series,
		};
		chartData.push(projectWork)
	}

	dates = dates.map(d => moment.utc(d).format("DD-MM"));
	ctx.body = {dates, chartData};
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
};
