const debug = require('debug')('webhook');
const createWebhook = require('@octokit/webhooks');
const config = require('./config');

debug("Registering webhook...");
module.exports = new createWebhook({
	secret: config.webhookSecret
});