'use strict';

const path = require('path');
const i18n = require('koa-i18n');
const locale = require('koa-locale');

module.exports = (app) => {
	locale(app);
	return i18n(app, {
		extension: '.json',
		directory: path.resolve(__dirname, '../locales'),
		locales: ['en'],
		modes: ['query', 'header', 'cookie', 'tld'],
	});
};
