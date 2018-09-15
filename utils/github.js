const debug = require('debug')('github');
const createGitHubApp = require('github-app');
const config = require('./config');
const privateKey = require('./privatekey');

debug("Registering Github app...");
module.exports = createGitHubApp({
	id: config.githubAppID,
	cert: privateKey
});