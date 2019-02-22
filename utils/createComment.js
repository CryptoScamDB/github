const debug = require('debug')('createContent');
const yaml = require('js-yaml');
const download = require('download')
const urlScanReport = require('./urlscan');
const app = require('./github');
const server = require('./server');
const config = require('./config');
const makeReq = require('./makeReq');


const createComment = (payload) => {
  return new Promise(async (resolve, reject) => {
    debug("New PR opened! (" +  + "/" + payload.repository.name + "; #" + payload.pull_request.number + ")");
    const github = await app.asInstallation(payload.installation.id);
  
    /* CommandsFile */
    let originalBranchCommands
    let pullRequestBranchCommands;
    try {
      originalBranchCommands = await download('https://raw.githubusercontent.com/CryptoScamDB/blacklist/' + payload.pull_request.base.sha + '/commands/cmd.yaml');
      pullRequestBranchCommands = await download('https://raw.githubusercontent.com/CryptoScamDB/blacklist/' + payload.pull_request.head.sha + '/commands/cmd.yaml');
    } catch (e) {
      debug("Getting PR branch scams...");
      if(!originalBranchCommands) {
        originalBranchCommands = [];
      }
      if(!pullRequestBranchCommands) {
        try {
          pullRequestBranchCommands = await download('https://raw.githubusercontent.com/CryptoScamDB/blacklist/' + payload.pull_request.head.sha + '/commands/cmd.yaml');
        } catch (e) {
          pullRequestBranchCommands = [];
        }
      }
    }
  
    /* Handle Commands Additions */
    let newCommandsEntries;
    if(!originalBranchCommands && !pullRequestBranchCommands) {
      newCommandsEntries = null;
    } else {
      const originalCommandsContent = yaml.safeLoad(Buffer.from(originalBranchCommands,'base64').toString());
      const pullRequestCommandsContent = yaml.safeLoad(Buffer.from(pullRequestBranchCommands,'base64').toString());
      if(originalCommandsContent && pullRequestCommandsContent) {
        const oldCommandsEntries = originalCommandsContent.map(entry => entry.data.url);
        newCommandsEntries = await Promise.all(
          pullRequestCommandsContent.map(
            entry => entry.data.url
          ).filter(
            entry => !oldCommandsEntries.includes(entry)
          ).map(
            url => pullRequestCommandsContent.find(
              entry => entry.data.url === url
            )
          ).map(async entry => {
            entry.data.URLScan = (await urlScanReport(entry.data.url)) || '(Error)';
            return entry.data;
          })
        );
      } else if(!originalCommandsContent && pullRequestCommandsContent){
        if(!pullRequestCommandsContent.length) {
          newCommandsEntries = [pullRequestCommandsContent.data];
        } else {
          newCommandsEntries = pullRequestCommandsContent.map(entry => {
            if (entry.type.toLowerCase() === "ADD".toLowerCase()) {
              return entry.data;
            }
          })
        }
      }
  
    }
  
    /* Combine ScamsFile and Commands Additions */
    debug("Combining ScamsFile and Commands Additions...");
    const newEntriesArray = [];
    await Promise.all(    
      newCommandsEntries.map(entry => {
        newEntriesArray.push(entry);
      })
    );
    const newEntriesConst = newEntriesArray;
  
    /* Download scams file */
    const originalScamsFile = await download('https://raw.githubusercontent.com/CryptoScamDB/blacklist/' + payload.pull_request.base.sha + '/data/urls.yaml');
    const parsedOriginalScamsFile = await yaml.safeLoad(Buffer.from(originalScamsFile,'base64').toString());
    const newScamsFile = await JSON.parse(JSON.stringify(parsedOriginalScamsFile));
    await Promise.all(
      newEntriesConst.map(entry => {
        newScamsFile.push(entry)
      })   
    );

    /* Create new commit */
    const newScamsMaterial = await Buffer.from(yaml.safeDump(newScamsFile, { lineWidth: 99999999, indent: 4 })).toString('base64');
    const headUrl = 'https://api.github.com/repos/cryptoscamdb/blacklist/git/trees/' + payload.pull_request.head.sha;
    const allTreesPreAdd = JSON.parse(await makeReq(headUrl));
    const dataTreeItemPreAdd = await allTreesPreAdd.tree.find(entry => {
      return entry.path === 'data';
    });
    const allDataTrees = JSON.parse(await makeReq(dataTreeItemPreAdd.url));
    const urlsObject = await allDataTrees.tree.find(entry => {
      return (entry.path === 'urls.yaml')
    });
  
    let options = {
      owner: 'cryptoscamdb',
      repo: 'blacklist',
      path: 'data/urls.yaml',
      message: 'Added new entry',
      content: newScamsMaterial,
      sha: urlsObject.sha,
      branch: payload.pull_request.head.ref
    }
  
    try {
      if (config.autoCommit) {
        debug('AutoCommit is still in development - Continuing');
      } else {
        debug('AutoCommit is still in development and turned off - Continuing');
      }
    } catch (e) {
      debug(e);
    }
  
    /* Add URLScan to the message */
    const newEntries = await Promise.all(
      newEntriesArray.map(async entry => {
        entry.URLScan = (await urlScanReport(entry.url)) || '(Error)';
        return entry;
      })
    ); 
    let duplicate = false;
    const duplicateEntries = [];
    await Promise.all(
      await newEntries.map(async entry => {
        parsedOriginalScamsFile.map(en => {
          if (en.url.toLowerCase() === entry.url.toLowerCase()) {
            duplicateEntries.push(entry);
          };
        });
      })
    );
  
    duplicate = duplicateEntries.length >= 1 ? true : false;
  
    /* Creating comment with new additions */
    if(newEntries.length > 0) {
      debug('Making Comments now')
      if (!duplicate) {
        await github.issues.createComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          number: payload.pull_request.number,
          body: '**New entries added**: \n\n' + newEntries.map(entry => Object.keys(entry).map(key => '**' + key + '**: ' + entry[key]).join('\n')).join("\n<hr>\n")
        });
      } else {
        await github.issues.createComment({
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          number: payload.pull_request.number,
          body: '**New entries added**: \n\n' + newEntries.map(entry => Object.keys(entry).map(key => '**' + key + '**: ' + entry[key]).join('\n')).join("\n<hr>\n") + '\n\n' + '**Duplicate entries detected**: \n\n' + duplicateEntries.map(entry => Object.keys(entry).map(key => '**' + key + '**: ' + entry[key]).join('\n')).join("\n<hr>\n")
        });
      }
  
    } else {
      await github.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        number: payload.pull_request.number,
        body: '**No new entries added**'
      });
    }
    debug("Done!");
  })
}

module.exports = createComment;