const fs = require('fs');

if (!fs.existsSync('./config/private-key.pem')) {
	console.error("No private-key.pem found inside 'config' folder. Please go ahead and download it from your Github app settings page");
	process.exit();
} else {
	module.exports = fs.readFileSync('./config/private-key.pem');
}