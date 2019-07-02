'use strict';

const fs = require('fs');
const path = require('path');
const Log = require('unklogger');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const Handlebars = require('handlebars');
const juice = require('juice');
// const htmlToText = require('html-to-text');

const nodemailer = require('nodemailer');
// const sgMail = require('@sendgrid/mail');

const assign = require('lodash/assign');

/**
 * Settings.
 */
const TEMPLATES_DIR = path.resolve(__dirname, '../emails');
const FROM_EMAIL = process.env.EMAIL_FROM;
const PRODUCT_NAME = 'Timesheet';
const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT;
const COMPANY_NAME = 'Signapps';
const COMPANY_STREET = 'Tehnoloski park 24';
const COMPANY_POST = '1000 Ljubljana';

/**
 * Init.
 */

const userAgentParser = new UAParser();
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.GMAIL_USERNAME,
		pass: process.env.GMAIL_PASSWORD,
	},
});

/**
 * Load e-mail templates.
 */

console.log('Loading e-mail templates...');
let startTime = Number(new Date());

// Get list of all templates. Skip the directories ending with "_ignore".
let templateNames = fs.readdirSync(TEMPLATES_DIR)
	.filter(file => !file.endsWith('_ignore') &&
	fs.statSync(path.join(TEMPLATES_DIR, file)).isDirectory());

function loadAndCompileTemplate(filePath) {
	try {
		let source = fs.readFileSync(filePath, 'utf-8');
		let template = Handlebars.compile(juice(source));
		return template;
	} catch (error) {
		return null;
	}
}

// Load all templates from the templates dir.
let templates = new Map();
for (let templateName of templateNames) {
	let templateFilePath = path.join(TEMPLATES_DIR, templateName, './html.hbs');
	let templateSubjectFilePath = path.join(TEMPLATES_DIR, templateName, './subject.hbs');

	let body = loadAndCompileTemplate(templateFilePath);
	if (body == null) {
		console.error(`Failed to load "${templateName}" email template.`);
		continue;
	}

	let subject = loadAndCompileTemplate(templateSubjectFilePath);
	if (subject == null) {
		console.warn(`Failed to load "${templateName}" email template subject.`);
		subject = Handlebars.compile(juice(templateName));
	}

	templates.set(templateName, {
		subject: subject,
		body: body,
	});
}

console.log(`Finished loading e-mail templates. Took ${Number(new Date()) - startTime} milliseconds.`);

/**
 * Get agent details.
 */
function getAgentDetails(ctx) {
	// user-agent header from an HTTP request
	let ua = ctx.request.headers['user-agent'];
	let result = userAgentParser.setUA(ua).getResult();

	// Return default browser and os.
	if (!result) return {
		browser: { name: 'Unknown' },
		os: { name: 'Unknown' },
	};
	return result;
}

function getLocationFromIP(ctx) {
	let ip = ctx.state.ip;
	let loc = geoip.lookup(ip);
	if (loc == null) {
		return 'Unknown';
	}
	return `${loc.city}, ${loc.country}`;
}

/**
 * Render email template.
 *
 * @param {KoaContext} ctx
 * @param {string} template_name
 * @param {object} data
 */
function renderEmail(ctx, template_name, data) {
	// Resolve template name.
	if (!templates.has(template_name)) {
		throw new Error(`Template with name "${template_name}" not found.`);
	}
	let template = templates.get(template_name);

	// Assign the data.
	data = assign({
		product_name: PRODUCT_NAME,
		home_page: process.env.CLIENT_BASE_URL,
		support_email: SUPPORT_EMAIL,
		company_name: COMPANY_NAME,
		company_street: COMPANY_STREET,
		company_post: COMPANY_POST,

		year: `${(new Date()).getFullYear()}`,
		operating_system: '{{operating_system}}',
		browser_name: '{{browser_name}}',
		location: '{{location}}',
		name: '{{name}}',
		action_url: '{{action_url}}',
		email_address: '{{email_address}}',
	}, data);

	// Get agent browser and os.
	let agent = getAgentDetails(ctx);
	data.operating_system = agent.os.name;
	data.browser_name = agent.browser.name;
	data.location = getLocationFromIP(ctx);

	// Run the template render task.
	let email = {
		subject: template.subject(data),
		body: template.body(data),
		data: data,
	};

	return email;
}

/**
 * Send email.
 *
 * @param {KoaContext} ctx
 * @param {string} template_name
 * @param {object} data
 */
function sendEmail(ctx, template_name, data) {
	let email = renderEmail(ctx, template_name, data);

	// Extract body text.
	// let text = htmlToText.fromString(email.body, {
	// 	wordwrap: 130,
	// });

	// Build and send the email.
	// let msg = {
	// 	to: email.data.email_address,
	// 	from: FROM_EMAIL,
	// 	subject: email.subject,
	// 	text: text,
	// 	html: email.body,
	// };
	const mailOptions = {
		from: FROM_EMAIL,
		to: email.data.email_address,
		subject: email.subject,
		html: email.body,
	};
	// sgMail.send(msg).then(() => {
	// 	// Do nothing.
	// 	// console.log('Email sent.');
	// }).catch((error) => {
	// 	Log.error(error.message);
	// });

	transporter.sendMail(mailOptions).then(() => {
		// Do nothing.
		// console.log('Email sent.');
	}).catch((error) => {
		Log.error(error.message);
	});

	return email;
}

/**
 * Exported functions.
 * @type {Object}
 */
module.exports = {
	renderEmail,
	sendEmail,
};
