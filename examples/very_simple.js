var webhook = require('../');

var app = webhook.http({
  route: '/test-hook',
  token: 'keyboard cat'
}).listen(3000);