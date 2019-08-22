'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const isString = require('lodash.isstring');

const HIDDEN = [];
const HIDDEN_ENDS_WITH = ['_PASSWORD', '_KEY'];
const BOOLEANS = ['AUTO_MIGRATE_DB', 'KNEX_DEBUG'];
const CHOICES = {
	NODE_ENV: ['development', 'stage', 'production'],
};

function loadEnvFile(name) {
	let fpath = path.resolve(__dirname, '..', name);
	if (!fs.existsSync(fpath)) return [];
	let text = fs.readFileSync(fpath, 'utf-8');
	let lines = text.split(/\r?\n/g);
	lines = lines.map((line) => {
		let tokens = line.trim().split(/=(.*)/);
		if (tokens.length <= 0) return line;
		if ((tokens.length > 2) && (tokens[tokens.length - 1] === '')) tokens.pop();
		if (tokens.length !== 2) return line;
		return {
			key: tokens[0],
			value: tokens[1],
			line: line,
		};
	});
	return lines;
}

// Load .env.example.
let example = loadEnvFile('.env.example');
let exampleMap = new Map();
for (let line of example) {
	if (isString(line)) continue;
	exampleMap.set(line.key, line.value);
}

// Load .env.
let env = loadEnvFile('.env');
let envMap = new Map();
let unknownLines = [];
for (let line of env) {
	if (isString(line)) {
		if (line.trim().length <= 0) continue;
		unknownLines.push(line);
	} else if (!exampleMap.has(line.key)) {
		unknownLines.push(line.line);
	} else {
		envMap.set(line.key, line.value);
	}
}

let missingMap = new Map();
let existingMap = new Map();
for (let line of example) {
	if (isString(line)) continue;
	if (envMap.has(line.key)) existingMap.set(line.key, envMap.get(line.key));
	else missingMap.set(line.key, line.value);
}

async function menuPick() {
	let options = [];
	if (missingMap.size > 0) {
		options.push(`Set missing values (${missingMap.size} are missing)`);
	}
	if (existingMap.size > 0) {
		options.push(`Edit existing values (${existingMap.size} values)`);
	}
	options.push('Exit');

	let opt = await inquirer.prompt([{
		type: 'list',
		name: 'opt',
		message: 'Options:',
		choices: options,
	}]);

	if (opt.opt.startsWith('Set missing')) return 'add';
	else if (opt.opt.startsWith('Edit existing')) return 'edit';
	else return 'exit';
}

function isHidden(key) {
	return HIDDEN.includes(key) || HIDDEN_ENDS_WITH.filter(h => key.endsWith(h)).length > 0;
}

async function setValue(key, def) {
	if (BOOLEANS.includes(key)) {
		let ans = await inquirer.prompt([{
			type: 'confirm',
			name: 'ans',
			message: `${key}:`,
			default: def.toLowerCase() === 'true',
		}]);
		missingMap.delete(key);
		existingMap.set(key, ans.ans ? 'true' : 'false');
	} else if (key in CHOICES) {
		let ans = await inquirer.prompt([{
			type: 'list',
			name: 'ans',
			message: `${key}:`,
			choices: CHOICES[key],
			default: def,
		}]);
		missingMap.delete(key);
		existingMap.set(key, ans.ans);
	} else if (isHidden(key)) {
		let ans = await inquirer.prompt([{
			type: 'password',
			mask: '*',
			name: 'ans',
			message: `${key}:`,
		}]);
		missingMap.delete(key);
		existingMap.set(key, ans.ans);
	} else {
		let ans = await inquirer.prompt([{
			type: 'input',
			name: 'ans',
			message: `${key}:`,
			default: def,
		}]);
		missingMap.delete(key);
		existingMap.set(key, ans.ans);
	}

	saveEnv();
}

async function setMissingValues() {
	console.log('');
	console.log('To use the default value just press ENTER.');
	console.log('');

	for (let line of example) {
		if (isString(line)) continue;
		let key = line.key;
		if (existingMap.has(key)) continue;
		await setValue(key, missingMap.get(key));
	}

	console.log('');
	console.log('Missing values are set.');
	console.log('');
}

async function editExistingValues() {
	let lastOpt = null;
	while (true) {
		let map = new Map();
		let def = null;
		for (let line of example) {
			if (isString(line)) continue;
			let key = line.key;
			if (!existingMap.has(key)) continue;

			let val = null;
			if (isHidden(key)) val = `Edit ${key} (value: ${existingMap.get(key).length > 0 ? '*****' : ''})`;
			else val = `Edit ${key} (value: ${existingMap.get(key)})`;
			map.set(val, key);
			if (key === lastOpt) def = val;
		}
		let options = Array.from(map.keys());
		options.push('Exit.');

		let opt = await inquirer.prompt([{
			type: 'list',
			name: 'opt',
			message: 'Pick a variable to edit:',
			choices: options,
			default: def,
		}]);

		if (!map.has(opt.opt)) {
			return;
		}

		let key = map.get(opt.opt);
		lastOpt = key;
		await setValue(key, existingMap.get(key));
		console.log('');
	}
}

function saveEnv() {
	// Compose new file.
	let newEnvLines = [];
	let hasEmptyLine = false;
	if (example.length > 0) {
		for (let line of example) {
			if (isString(line)) {
				if (!hasEmptyLine) newEnvLines.push('');
				hasEmptyLine = true;
				continue;
			}
			if (!existingMap.has(line.key)) continue;
			newEnvLines.push(`${line.key}=${existingMap.get(line.key)}`);
			hasEmptyLine = false;
		}
		if (!hasEmptyLine) newEnvLines.push('');
	}

	// Attach unknown lines.
	if (unknownLines.length > 0) {
		for (let line of unknownLines) newEnvLines.push(line);
		newEnvLines.push('');
	}

	// Write to file.
	let newText = newEnvLines.join('\n');
	fs.writeFileSync(path.resolve(__dirname, '..', '.env'), newText, 'utf-8');
}

// Main loop.
async function asyncWrapper() {
	let state = 'edit';
	if (missingMap.size > 0) {
		state = 'menu';
	}

	// eslint-disable-next-line no-labels
	mainLoop:
	while (true) {
		switch (state) {
			case 'menu':
				state = await menuPick();
				break;
			case 'edit':
				await editExistingValues();
				// eslint-disable-next-line no-labels
				break mainLoop;
			case 'add':
				await setMissingValues();
				// eslint-disable-next-line no-labels
				break mainLoop;
			case 'exit':
				// eslint-disable-next-line no-labels
				break mainLoop;
			default:
				// eslint-disable-next-line no-labels
				break mainLoop;
		}
	}
}

asyncWrapper()
	.then(() => {
		process.exit(0);
	})
	.catch(error => {
		console.error(error.message);
		console.error('Exit.');
		process.exit(1);
	});
