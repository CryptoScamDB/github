const request = require('request');

const makeRequest = (url) => {
  return new Promise(async (resolve, reject) => {
    let options = {
      method: "GET",
      headers: {
        "User-Agent": 'scamreportbot'
      }
    }
    request(url, options, (err, response, body) => {
      if(err || response.statusCode === 404 || response.statusCode === 403) reject(err);
      else {
        resolve(body);
      }
    })
  })
}

module.exports = makeRequest;