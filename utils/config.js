const debug = require('debug')('config');
const fs = require('fs');

debug("Checking if config exists...");
if (!fs.existsSync('./config/config.json')) {
	debug("No config found");
    throw new Error("No config.json found. Make sure to go into the 'config' folder, rename config.example.json to config.json and to update the values inside");
} else {
	debug("Found config");
	module.exports = require('../config/config.json');
}