const configService = require('../config/config-service');
const configFr = configService.getConfigFr();
//const terminalService = require('../services/terminal-service');

const sendCommandInfo = async (req, res, next) => {
  res.json({
    status: 'ok',
    message: 'exellioOle2Http server is up',
    configFr: configFr,
  });
};

const sendCommand = async (req, res, next) => {
    
    switch (req.body.type) {
        case 'purchase':
            opPurchase(req.body.start);
            break;
        case 'return':
            console.log('Mangoes and papayas are $2.79 a pound.');
            // Expected output: "Mangoes and papayas are $2.79 a pound."
            break;
        case 'putgetmoney':
            console.log('Mangoes and papayas are $2.79 a pound.');
            // Expected output: "Mangoes and papayas are $2.79 a pound."
            break;
        case 'openshift':
            console.log('Mangoes and papayas are $2.79 a pound.');
            // Expected output: "Mangoes and papayas are $2.79 a pound."
            break;
        case 'zreport':
            console.log('Mangoes and papayas are $2.79 a pound.');
            // Expected output: "Mangoes and papayas are $2.79 a pound."
            break;
        case 'xreport':
            console.log('Mangoes and papayas are $2.79 a pound.');
            // Expected output: "Mangoes and papayas are $2.79 a pound."
            break;
        case 'xreport':
            console.log('Mangoes and papayas are $2.79 a pound.');
            // Expected output: "Mangoes and papayas are $2.79 a pound."
            break;
        default:
            console.log(`Sorry, we are out of ${expr}.`);
    }
    
    res.json({
      status: 'ok',
      message: 'exellioOle2Http server is up',
      configFr: configFr,
    });
  };

const opPurchase = () => {

}

exports.sendCommandInfo = sendCommandInfo;
exports.sendCommand = sendCommand;