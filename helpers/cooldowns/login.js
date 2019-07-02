'use strict';

const COOLDOWNS = [];
// After first 4 attempts cool down for 2 seconds.
for (let i = 0; i < 4; i++) COOLDOWNS.push(2 * 1000); // In miliseconds.
// After the 5th attempt cool down for 1 minute.
for (let i = 0; i < 2; i++) COOLDOWNS.push(60 * 1000); // In miliseconds.
// After the 7th attempt cool down for 5 minutes.
for (let i = 0; i < 2; i++) COOLDOWNS.push(5 * 60 * 1000); // In miliseconds.
// After the 9th attempt cool down for 15 minutes.
for (let i = 0; i < 2; i++) COOLDOWNS.push(15 * 60 * 1000); // In miliseconds.
// After the 11th attempt cool down for 1 hour.
for (let i = 0; i < 2; i++) COOLDOWNS.push(60 * 60 * 1000); // In miliseconds.
// After the 13th attempt cool down for 4 hours.
for (let i = 0; i < 2; i++) COOLDOWNS.push(4 * 60 * 60 * 1000); // In miliseconds.
// After the 15th attempt cool down for 24 hours.
COOLDOWNS.push(24 * 60 * 60 * 1000); // In miliseconds.

module.exports = COOLDOWNS;
