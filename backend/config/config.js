module.exports = {
  app: {
    port: 5715,
    dummyFr: false,
    dummyFrError: false,
    token: 'a3cbe070577cf13367904316f5d3f037',
  },
  fr: {
    workDirectory: 'F:/Bases/dev_webCashBox/exellioOle2http/backend/builds/build-win64/frCategory',
    timeout: 5000,
    type: 'serial',
    serialConfig: {
      port: 'com1',
      speed: 115200
    },
    httpConfig: {
      ip: '',
      port: ''
    }
  }
};
