const fs = require('fs');
const path = require('path');
const pathConfig = path.join(process.cwd(), 'config.json');
// let pathWorkDir = path.join(process.cwd(), 'frCategory');
// if (!fs.existsSync(path)) {
//   pathWorkDir = path.join(process.cwd(), '..', '..', 'frCategory');
// }
const configExist = fs.existsSync(pathConfig);
const config = require('./config');
let configData;
if (configExist) {
  configData = JSON.parse(fs.readFileSync(pathConfig, { encoding: 'utf8', flag: 'r' }));
}

const getConfig = () => {
  if (configExist) {
    return configData.app;
  } else {
    return config.app;
  }
};

const getConfigFr = () => {
  if (configExist) {
    return configData.fr;
  } else {
    return config.fr;
  }
};

exports.getConfig = getConfig;
exports.getConfigFr = getConfigFr;
// exports.pathWorkDir = pathWorkDir;
