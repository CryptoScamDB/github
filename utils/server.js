const debug = require('debug')('http');
const http = require('http');
const config = require('./config');
const webhooks = require('./webhook');

debug("Registering http server...");
module.exports = http.createServer(webhooks.middleware).listen(config.port);