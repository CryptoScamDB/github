const debug = require('debug')('webhook');
const createWebhook = require('github-webhook-handler');
const config = require('./config');

debug("Registering webhook...");
module.exports = createWebhook({
	path: '/',
	secret: config.webhookSecret
});