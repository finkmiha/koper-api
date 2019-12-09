'use strict';

const Moment = require('moment');
const MomentRange = require('moment-range');
const momentDurationFormatSetup = require('moment-duration-format');

const moment = MomentRange.extendMoment(Moment);
momentDurationFormatSetup(moment);

let Holidays = require('date-holidays');
let hd = new Holidays();
hd.init('SI');
let xl = require('excel4node');

const UserDAO = require('../dao/user');
const Work = require('../models/work');

let WEEKDAYS = ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'];
let MONTHS = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'];

async function createExcelExport(ctx, month) {
	// Create a new instance of a Workbook class
	let wb = new xl.Workbook({
		defaultFont: {
			size: 11,
			name: 'Calibri',
		},
	});

	// Add Worksheets to the workbook
	let ws = wb.addWorksheet('Sheet 1');

	ws.column(3).setWidth(13);
	ws.column(11).setWidth(15);
	ws.column(12).setWidth(15);
	ws.column(14).setWidth(150);
	ws.row(6).setHeight(30);

	// Create a reusable styles
	let borderCenter = wb.createStyle({

		alignment: {
			horizontal: 'center',
			vertical: 'center',
		},
		border: {
			left: {
				style: 'medium',
			},
			right: {
				style: 'medium',
			},
			top: {
				style: 'medium',
			},
			bottom: {
				style: 'medium',
			},
		},
		fill: {
			type: 'pattern',
			patternType: 'solid',
			bgColor: '#E7E6E6',
			fgColor: '#E7E6E6',
		},
		font: {
			bold: true,
			size: 11,
			name: 'Calibri',
		},
	});

	let weekendStyle = wb.createStyle({
		alignment: {
			wrapText: true,
		},
		border: {
			left: {
				style: 'thin',
			},
			right: {
				style: 'thin',
			},
			top: {
				style: 'thin',
			},
			bottom: {
				style: 'thin',
			},
		},
		fill: {
			type: 'pattern',
			patternType: 'solid',
			bgColor: '#E7E6E6',
			fgColor: '#E7E6E6',
		},
		font: {
			bold: true,
			size: 11,
			name: 'Calibri',
		},
	});

	let thinBorder = wb.createStyle({
		border: {
			left: {
				style: 'thin',
			},
			right: {
				style: 'thin',
			},
			top: {
				style: 'thin',
			},
			bottom: {
				style: 'thin',
			},
		},
	});

	let exportData = await getExportData(ctx, month);

	// Title.
	ws.cell(1, 6)
		.string('                                                                                                                                                                                   LISTA PRISOTNOSTI')
		.style({ font: { bold: true,
			size: 16,
			name: 'Calibri' } });

	// User name, last name and date.
	ws.cell(3, 1)
		.string(`Ime in Priimek ____________________________                                                    Mesec: ${exportData.month} ${exportData.year}`)
		.style({ font: { bold: true,
			size: 11,
			name: 'Calibri' } });

	// Table header.
	ws.cell(6, 1, 7, 1, true).string('Datum').style(borderCenter);
	ws.cell(6, 2, 7, 2, true).string('Dan').style(borderCenter);
	ws.cell(6, 3, 7, 3, true).string('Začetek\n Dela').style(borderCenter);
	ws.cell(6, 4, 7, 4, true).string('Konec\n Dela').style(borderCenter);
	ws.cell(6, 5, 6, 6, true).string('Odmor 1').style(borderCenter);
	ws.cell(6, 7, 6, 8, true).string('Odmor 2').style(borderCenter);
	ws.cell(6, 9, 6, 10, true).string('Odmor 3').style(borderCenter);
	ws.cell(7, 5).string('od').style(borderCenter);
	ws.cell(7, 6).string('do').style(borderCenter);
	ws.cell(7, 7).string('od').style(borderCenter);
	ws.cell(7, 8).string('do').style(borderCenter);
	ws.cell(7, 9).string('od').style(borderCenter);
	ws.cell(7, 10).string('do').style(borderCenter);
	ws.cell(6, 11, 7, 11, true).string('Ure po\n faktorju').style(borderCenter);
	ws.cell(6, 12, 7, 12, true).string('DEJANSKE URE').style(borderCenter);
	ws.cell(6, 13, 7, 13, true).string('Nadure').style(borderCenter);
	ws.cell(6, 14, 7, 14, true).string('Opis delovnih nalog').style(borderCenter);

	let table_data = exportData.table_data;
	for (let i = 8; i < 8 + table_data.length; i++) {
		for (let j = 1; j < 15; j++) {
			if (j !== 1 && table_data[i - 8][10] === '') {
				ws.cell(i, j).string(table_data[i - 8][j - 1]).style(weekendStyle);
			} else {
				ws.cell(i, j).string(table_data[i - 8][j - 1]).style(thinBorder);
			}
		}
	}

	// TODO: Finish export excel sheet.
	let stats = exportData.stats;
	ws.cell(40, 1).string(`Število malic: ${stats.lunch_count}`);
	ws.cell(41, 1).string(`Število prevozov: ${stats.lunch_count}`);

	ws.cell(40, 8).string('Dejanske ure').style({ font: { bold: true } });
	ws.cell(41, 8).string('Dopust').style({ font: { bold: true } });
	ws.cell(42, 8).string('Bolniška').style({ font: { bold: true } });
	ws.cell(43, 8).string('KU').style({ font: { bold: true } });
	ws.cell(44, 8).string('Praznik').style({ font: { bold: true } });
	// Ws.cell(45, 8).string('Faktor').style({ font: { bold: true } });
	ws.cell(45, 8).string('Prenos ur pret. obdobja').style({ font: { bold: true } });
	ws.cell(46, 8).string('Prenos ur').style({ font: { bold: true } });

	ws.cell(40, 11, 44, 13, false).style(thinBorder);
	ws.cell(45, 13, 46, 13, false).style(thinBorder);

	ws.cell(40, 11).string(stats.total_factor);
	ws.cell(40, 12).string(stats.total_hours);
	ws.cell(40, 13).string(stats.total_extra_hours);

	ws.cell(41, 11).string(stats.total_vacation);
	ws.cell(41, 12).string(stats.total_vacation);

	ws.cell(42, 11).string(stats.total_sick_leave);
	ws.cell(42, 12).string(stats.total_sick_leave);

	ws.cell(44, 11).string(stats.total_holiday);
	ws.cell(44, 12).string(stats.total_holiday);

	ws.cell(52, 1).string('Podpis delavec ____________________________');
	ws.cell(52, 8).string('Podpis nadrejeni ____________________________');

	let buffer = await wb.writeToBuffer();

	ctx.set('Content-disposition', 'attachment; filename=Hours.xlsx');
	ctx.set('Content-type', 'file/xlsx');
	ctx.body = buffer;
}

async function getExportData(ctx, month) {
	let user = await UserDAO.show(ctx, ctx.state.user.id, true);
	// Let user = { id: 2 };
	// Let month = moment.utc().format('YYYY-MM');
	// let month = '2019-11';
	let from_date = moment.utc().format(`${month}-01`);
	let date = from_date;
	let month_number = moment.utc(date).month();
	let year = moment.utc(date).format('YYYY');
	let to_date = moment.utc(date).endOf('month').format('YYYY-MM-DD');
	let dates = [];

	// TODO: Implement KU.
	let total_hours = 0;
	let total_extra_hours = 0;
	let total_vacation = 0;
	let total_sick_leave = 0;
	let total_holiday = 0;
	let work = {};
	while (moment(date).isBetween(from_date, to_date, null, '[]')) {
		dates.push(date);
		let dayOfWeek = moment.utc(date).day();
		// 'Day', 'Start', 'End', 'Intervals', 'Lunch', 'Work done', 'Projects', 'Description'
		work[date] = {
			day: WEEKDAYS[dayOfWeek],
			start: [],
			end: [],
			lunch: [],
			work_done: 0,
			extra_hours: 0,
			description: [],
		};
		date = moment.utc(date).add(1, 'day').format('YYYY-MM-DD');
	}

	let workIntervals = await Work.where('user_id', user.id).where('day', 'like', `${month}%`).withSelect('project', 'name').withSelect('type', 'type').get();
	workIntervals = workIntervals.toJSON();

	for (let workInterval of workIntervals) {
		let type = workInterval.type.type;
		let date = workInterval.day;
		let start = moment.utc(workInterval.start).format('HH:mm');
		let end = moment.utc(workInterval.end).format('HH:mm');
		if (type == 'Effective work') {
			work[date].start.push(start);
			work[date].end.push(end);
			work[date].work_done += workInterval.time_elapsed;
			work[date].description.push(workInterval.description);
			total_hours += workInterval.time_elapsed;
		} else if (type == 'Extra hours') {
			work[date].start.push(start);
			work[date].end.push(end);
			work[date].work_done += workInterval.time_elapsed;
			work[date].extra_hours += workInterval.time_elapsed;
			// Work[date].description.push(workInterval.description);
			total_hours += workInterval.time_elapsed;
			// Total_extra_hours += workInterval.time_elapsed;
		} else if (type == 'Lunch break') {
			work[date].lunch.push(start);
			work[date].lunch.push(end);
		} else if (type == 'Vacation') {
			work[date].work_done += workInterval.time_elapsed;
			work[date].description.push('DOPUST');
			total_hours += workInterval.time_elapsed;
			total_vacation += workInterval.time_elapsed;
		} else if (type == 'Sick leave') {
			work[date].work_done += workInterval.time_elapsed;
			work[date].description.push('BOLNISKA');
			total_hours += workInterval.time_elapsed;
			total_sick_leave += workInterval.time_elapsed;
		}
	}

	let lunch_count = 0;
	let total_factor = 0;
	let table_data = [];
	for (let date of dates) {
		let holiday = hd.isHoliday(new Date(date));
		if (holiday && holiday.type === 'public') {
			let daily_data = [date, work[date].day, '', '', '', '', '', '', '', '', '8:00', '08:00', '', holiday.name.toUpperCase()];
			total_holiday += 28800;
			// Lunch_count -= 1;
			table_data.push(daily_data);
			continue;
		}
		// Get only starting time and end time from work intervals
		let min = '';
		let max = '';
		if (work[date].start.length > 0 && work[date].end.length > 0) {
			min = `${work[date].start.reduce((min, start) => (start < min ? start : min), work[date].start[0])}`;
			max = `${work[date].end.reduce((max, end) => (end > max ? end : max), work[date].end[0])}`;
		}
		delete work[date].start;
		delete work[date].end;
		work[date].start = min;
		work[date].end = max;
		let descriptions = '';
		if (work[date].description.length > 0) {
			descriptions = work[date].description.filter(d => d !== null).join(' ');
		}
		delete work[date].description;
		work[date].description = descriptions;

		// Handle extra hours
		if (work[date].work_done > 0) {
			let extra_hours = work[date].work_done - 28800;
			total_extra_hours += extra_hours;
			if (extra_hours >= 0 && extra_hours < 3600) {
				work[date].extra_hours = '00:' + moment.duration(extra_hours, 'seconds').format('hh[:]mm');
			} else if (extra_hours > -3600 && extra_hours < 0) {
				work[date].extra_hours = '-00:' + moment.duration(extra_hours, 'seconds').format('hh[:]mm');
			} else {
				work[date].extra_hours = moment.duration(extra_hours, 'seconds').format('hh[:]mm');
			}
			if (work[date].extra_hours === '00:00') work[date].extra_hours = '';
		}
		if (work[date].extra_hours === 0) work[date].extra_hours = '';
		// Lunch count
		if (work[date].work_done >= 13500 && descriptions !== 'BOLNISKA' && descriptions !== 'DOPUST') {
			lunch_count += 1;
		}

		if (work[date].work_done < 3600) {
			work[date].work_done = '00:' + moment.duration(work[date].work_done, 'seconds').format('hh[:]mm');
		} else {
			work[date].work_done = moment.duration(work[date].work_done, 'seconds').format('hh[:]mm');
		}
		if (work[date].work_done === '00:00') work[date].work_done = '';

		while (work[date].lunch.length < 6) {
			work[date].lunch.push('');
		}

		let factor = '';
		if (work[date].day !== 'Sobota' && work[date].day !== 'Nedelja') {
			factor = '8:00';
			total_factor += 28800;
		}
		work[date].factor = factor;

		let daily_data = [date, work[date].day, work[date].start, work[date].end, work[date].lunch[0], work[date].lunch[1], work[date].lunch[2], work[date].lunch[3], work[date].lunch[4], work[date].lunch[5], work[date].factor, work[date].work_done, work[date].extra_hours, work[date].description];
		table_data.push(daily_data);
	}

	total_hours = moment.duration(total_hours, 'seconds').format('hh[:]mm');
	if (total_hours === '00') total_hours = '';

	total_extra_hours = moment.duration(total_extra_hours, 'seconds').format('hh[:]mm');
	if (total_extra_hours === '00') total_extra_hours = '';

	total_vacation = moment.duration(total_vacation, 'seconds').format('hh[:]mm');
	if (total_vacation === '00') total_vacation = '';

	total_sick_leave = moment.duration(total_sick_leave, 'seconds').format('hh[:]mm');
	if (total_sick_leave === '00') total_sick_leave = '';

	total_factor = moment.duration(total_factor, 'seconds').format('hh[:]mm');
	if (total_factor === '00') total_factor = '';

	total_holiday = moment.duration(total_holiday, 'seconds').format('hh[:]mm');
	if (total_holiday === '00') total_holiday = '';

	let stats = {
		lunch_count,
		total_hours,
		total_extra_hours,
		total_factor,
		total_vacation,
		total_sick_leave,
		total_holiday,
	};

	return { table_data,
		stats,
		month: MONTHS[month_number],
		year };
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	createExcelExport,
};
