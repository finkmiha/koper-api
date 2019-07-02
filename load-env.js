'use strict';

const fs = require('fs');
const path = require('path');
const secret = require(path.resolve(__dirname, './helpers/secret'));

// Load .env configuration.
require('dotenv').config({
	path: path.resolve(__dirname, './.env'),
});

// Set default port values.
process.env.SERVER_PORT = process.env.SERVER_PORT || 3000;

// Set the default values of env variables.
process.env.SERVER_BASE_URL =
  process.env.SERVER_BASE_URL || 'http://localhost:3000';

process.env.CLIENT_BASE_URL =
  process.env.CLIENT_BASE_URL || 'http://localhost:3000';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.NODE_ENV_ALIAS = 'Unknown';
if (process.env.NODE_ENV === 'development') {
	process.env.NODE_ENV_ALIAS = 'Dev';
} else if (process.env.NODE_ENV === 'stage') {
	process.env.NODE_ENV_ALIAS = 'Stage';
} else if (process.env.NODE_ENV === 'production') {
	process.env.NODE_ENV_ALIAS = 'Live';
}

// Default database config.
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_PORT = process.env.MYSQL_PORT || 3307;
process.env.MYSQL_USER = process.env.MYSQL_USER || 'root';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'talenttin';

// Generate secret keys.
function checkJWTSecret(name) {
	// Check if JWT secret preset. If not then generate it.
	if (process.env[name] == null) {
		let jwtSecret = secret.generateSecret();
		fs.appendFileSync(path.resolve(__dirname, './.env'),
			`\n${name}=` + jwtSecret + '\n');
		process.env[name] = jwtSecret;
		console.log(`${name} generated.`);
	}
}

// Generate JWT secret for authorization purposes.
checkJWTSecret('JWT_SECRET');
