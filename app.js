const debug = require('debug')('app');
const yaml = require('js-yaml');

const config = require('./utils/config');
const urlScanReport = require('./utils/urlscan');
const app = require('./utils/github');
const server = require('./utils/server');
const webhook = require('./utils/webhook');

webhook.on('pull_request', async event => {
	if (event.payload.action === 'opened') {
		debug("New PR opened! (" + event.payload.repository.owner.login + "/" + event.payload.repository.name + "; #" + event.payload.pull_request.number + ")");
		const github = await app.asInstallation(event.payload.installation.id);
		debug("Getting original branch...");
		const originalBranch = await github.repos.getContent({
			owner: event.payload.repository.owner.login,
			repo: event.payload.repository.name,
			ref: event.payload.pull_request.base.ref,
			path: '_data/scams.yaml'
		});
		debug("Getting PR branch...");
		const pullRequestBranch = await github.repos.getContent({
			owner: event.payload.repository.owner.login,
			repo: event.payload.repository.name,
			ref: event.payload.pull_request.head.ref,
			path: '_data/scams.yaml'
		});
		/*const originalContent = yaml.safeLoad(Buffer.from(originalBranch.data.content,'base64').toString());
		const pullRequestContent = yaml.safeLoad(Buffer.from(pullRequestBranch.data.content,'base64').toString());
		const oldEntries = originalContent.map(entry => entry.url);
		const newEntries = await Promise.all(pullRequestContent.map(entry => entry.url).filter(entry => !oldEntries.includes(entry)).map(url => pullRequestContent.find(entry => entry.url === url)).map(async entry => {
			entry.URLScan = (await urlScanReport(entry.url)) || '(Error)';
			return entry;
		}));
		debug("Found " + newEntries.length + " new entries");
		debug("Creating comment...");
		if(newEntries.length > 0) {
			await github.issues.createComment({
				owner: event.payload.repository.owner.login,
				repo: event.payload.repository.name,
				number: event.payload.pull_request.number,
				body: '**New entries added**: \n\n' + newEntries.map(entry => Object.keys(entry).map(key => '**' + key + '**: ' + entry[key]).join('\n')).join("\n<hr>\n")
			});
		} else {
			await github.issues.createComment({
				owner: event.payload.repository.owner.login,
				repo: event.payload.repository.name,
				number: event.payload.pull_request.number,
				body: '**No new entries added**'
			});
		}
		debug("Done!");*/
	}
});

process.on('unhandledRejection', reason => {
	debug(reason);
});

debug("Started!");