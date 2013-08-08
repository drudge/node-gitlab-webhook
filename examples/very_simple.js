var webhook = require('../');

var app = webhook.http({
  route: '/test-hook',
  token: 'keyboard cat',
  ips: '*',
  branches: 'refs/heads/master',
  exec: 'npm run deploy'
}).listen(3000);