const debug = require('debug')('github');
const createGitHubApp = require('github-app');
const config = require('./config');
const privateKey = require('./privatekey');


const createGHApp = () => {
  try {
    debug("Registering Github app...");
    return (createGitHubApp({
      id: config.githubAppID,
      cert: privateKey
    }));
    debug("Finished registering Github app.");
  } catch (err) {
    debug(err);
  }
}

module.exports = createGHApp();