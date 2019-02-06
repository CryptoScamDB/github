const debug = require('debug')('webhook');
const createWebhook = require('@octokit/webhooks');
const config = require('./config');

const createGHWebhook = () => {
  try {
    debug("Registering webhook...");
    return (new createWebhook({
      secret: config.webhookSecret
    }));
    debug("Webhook registered")
  } catch (err) {
    debug(err);
  }
}


module.exports = createGHWebhook();