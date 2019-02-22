const makeReq = require('./makeReq');
const debug = require('debug')('getSha');

const getSha = (headSha, folder, file) => {
  return new Promise(async (resolve, reject) => {
    try {
      const headUrl = 'https://api.github.com/repos/cryptoscamdb/blacklist/git/trees/' + headSha;
      const allTreesPreAdd = JSON.parse(await makeReq(headUrl));
      const dataTreeItemPreAdd = await allTreesPreAdd.tree.find(entry => {
        return (entry.path === folder);
      });
      const allDataTrees = JSON.parse(await makeReq(dataTreeItemPreAdd.url));
      const urlsObject = await allDataTrees.tree.find(entry => {
        return (entry.path === file);
      });
      resolve(urlsObject.sha);
    } catch(err) {
      debug(err);
      reject(err);
    }
  })
}

module.exports = getSha;