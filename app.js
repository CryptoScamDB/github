const debug = require('debug')('app');
const yaml = require('js-yaml');
const download = require('download')

const config = require('./utils/config');
const makeReq = require('./utils/makeReq');
const urlScanReport = require('./utils/urlscan');
const app = require('./utils/github');
const webhook = require('./utils/webhook');
const getSha = require('./utils/getSha');




webhook.on('*', async ({id, name, payload}) => {
  if(name === 'pull_request') {
    debug('Seeing a new pr now.')
    if (payload.action === 'opened') {
      debug("New PR opened here")
      if (payload.pull_request.user.login === "scamreportbot") {
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
        const parsedOriginalScamsFile = yaml.safeLoad(Buffer.from(originalScamsFile,'base64').toString());
        const newScamsFile = parsedOriginalScamsFile;
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

        const duplicate = false;
        newEntries.forEach(entry => {
          const duplicateEntry = parsedOriginalScamsFile.find(en => {
            return en.url === entry.url
          })
          if (duplicateEntry) {
            duplicateEntries.push(duplicateEntry)
          }
          
        });
        if (duplicateEntries) {
          duplicate = true;
        }
  
        /* Creating comment with new additions */
        if(newEntries.length > 0) {
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
      } else {
        debug('Entry not made by scamreportbot. Do not auto-commit');
      }
      
    }
  
    /* IF PR IS CLOSED AND MERGED */
    if (payload.action === 'closed') {
      debug(`Event PR is 'closed'`)
  
      if (payload.pull_request.merged === true) {
        debug('New PR has been merged.');
        debug('Creating update commit');
        const github = await app.asInstallation(payload.installation.id);
  
        /* CommandsFile */
        let originalBranchCommands
        let pullRequestBranchCommands;
        try {
          originalBranchCommands = await download('https://raw.githubusercontent.com/CryptoScamDB/blacklist/' + payload.pull_request.base.sha + '/commands/cmd.yaml');
        } catch (e) {
          debug("Getting PR branch scams...");
          originalBranchCommands = [];
          pullRequestBranchCommands = await download('https://raw.githubusercontent.com/CryptoScamDB/blacklist/' + payload.pull_request.head.sha + '/commands/cmd.yaml');
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
            debug("Found " + newCommandsEntries.length + " new commands entries");
            debug("Creating comment...");
          } else if(!originalCommandsContent && pullRequestCommandsContent){
            if(!pullRequestCommandsContent.length) {
              newCommandsEntries = [pullRequestCommandsContent.data];
            } else {
              newCommandsEntries = pullRequestCommandsContent.map(entry => {
                return entry.data;
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
        const parsedOriginalScamsFile = yaml.safeLoad(Buffer.from(originalScamsFile,'base64').toString());
        const newScamsFile = parsedOriginalScamsFile;
        await Promise.all(
          newEntriesConst.map(entry => {
            newScamsFile.push(entry)
          })   
        );
        const newScamsMaterial = await Buffer.from(yaml.safeDump(newScamsFile, { lineWidth: 99999999, indent: 4 })).toString('base64');
  
        try {
          if (config.autoCommit) {
            /* Create new commit */
            debug('Creating update file commit')
            let updateOptions = {
              owner: 'cryptoscamdb',
              repo: 'blacklist',
              path: 'data/urls.yaml',
              message: 'Added new entry',
              content: newScamsMaterial,
              sha: await getSha(payload.pull_request.base.sha, 'data', 'urls.yaml'),
              branch: payload.pull_request.head.ref
            }
            await github.repos.updateFile(updateOptions);
          } else {
            debug('AutoCommit is turned off - Continuing');
          }
        } catch (e) {
          debug(e);
        }
  
        try {
          if (config.deleteCommands) {
            /* Creating commands removal commit */
            debug('Creating commands removal commit');
            let commandsOptions = {
              owner: 'cryptoscamdb',
              repo: 'blacklist',
              path: 'commands/cmd.yaml',
              message: 'deleted the commands file',
              sha: await getSha(payload.pull_request.head.sha, 'commands', 'cmd.yaml'),
              branch: 'master'
            }
            await github.repos.deleteFile(commandsOptions);
          } else {
            debug('AutoCommit is turned off - Continuing');
          }
        } catch (e) {
          debug(e);
        }
      }
    }
  }
})

process.on('unhandledRejection', reason => {
	debug(reason);
});

debug("Started!");
