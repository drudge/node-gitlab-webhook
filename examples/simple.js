var express = require('express');
var http = require('http');
var webhook = require('../');

var app = express();

app.gitlab('/123-gitlab-hook', {
  exec: 'echo "hi"',
  token: 'CA572F1C-7BEB-467E-B26F-8999AB09CD4C',
  branches: 'refs/heads/production'
});

app.gitlab('/321-gitlab-hook');

app.gitlab('/231-gitlab-hook' , { token: 'keyboard cat' });

http.createServer(app).listen(process.env.PORT || 3000);