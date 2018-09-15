const debug = require('debug')('http');
const http = require('http');
const config = require('./config');
const webhook = require('./webhook');

debug("Registering http server...");
module.exports = http.createServer((req, res) => {
	webhook(req, res, err => {
		if (err) {
			console.error(err);
			res.statusCode = 500;
			res.end('500');
		} else {
			res.statusCode = 404;
			res.end('404');
		}
	});
}).listen(config.port);