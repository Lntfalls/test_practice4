'use strict';
const { createApp } = require('./src/app');

function start() {
  const port = Number(process.env.PORT || 3000);
  const server = createApp({ testMode: process.env.TEST_MODE === '1' });
  server.listen(port, '0.0.0.0', () => {
    console.log(`Учебное приложение: http://127.0.0.1:${port}`);
  });
  return server;
}

if (require.main === module) start();
module.exports = { start };
