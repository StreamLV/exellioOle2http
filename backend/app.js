// const uuid = require('uuid');
const axios = require('axios');
const express = require('express');
// const net = require('net');
// require('dotenv');

const configService = require('./config/config-service');
const config = configService.getConfig();
const configFr = configService.getConfigFr();
//
const winax = require('winax');
try {
  const fpOleObject = new winax.Object('ExellioFP.FiscalPrinter');  
  //const fpOleObject = new winax.Object('com.sun.star.ServiceManager');
  console.log('winax', 'CREATED!');
  //fpOleObject.ArtTablesDir = configFr.workDirectory;
  //console.log('WorkDirWriteRights', fpOleObject.CheckWorkDirWriteRights());  
} catch (error) {
  console.log('Ole error', error.message);
}
//

//const scheduleService = require('./services/schedule-service');

const rootRoutes = require('./routes/root-routes');
const exellioRoutes = require('./routes/exellio-routes');

//const HttpError = require('./helpers/http-error');

const app = express();

app.use(express.json());
app.use(express.urlencoded());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  // res.setHeader('Content-Type', 'application/json');
  next();
});

app.use('/', rootRoutes);
app.use('/api', exellioRoutes);

app.use((req, res, next) => {
  //const error = new HttpError('Could not find this route.', 404);
  //throw error;
  //return next(error);
  res
    .status(404)
    .json({ status: 'error', message: 'could not find this route' });
});

console.log('app started with config:', { config, configFr });
//console.log('port', config.port);
app.listen(config.port);