module.exports = {
  app: {
    port: 5715,
    dummyFr: false,
    dummyFrError: false,
    token: 'a3cbe070577cf13367904316f5d3f037',
  },
  fr: {
    timeout: 5000,
    type: 'serial',
    serialConfig: {
      port: 'com2',
      speed: 115200
    },
    httpConfig: {
      ip: '',
      port: ''
    }
  }
};
