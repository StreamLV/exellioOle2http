// const configTerminal = require('../config/configTerminal')[
//   process.env.NODE_ENV || 'development'
// ];
const configService = require('../config/config-service');
const configFr = configService.getConfigFr();

const checkStatus = async (req, res, next) => {
  res.json({
    status: 'ok',
    message: 'exellioOle2Http server is up',
    configFr: configFr,
  });
};

exports.checkStatus = checkStatus;
