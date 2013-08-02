var express = require('express');
var http = require('http');
var webhook = require('../');

var app = express();

app.use(express.bodyParser());
app.use(express.methodOverride());

app.gitlab('/123-gitlab-hook', {
  exec: 'jake deploy',
  token: 'CA572F1C-7BEB-467E-B26F-8999AB09CD4C',
  branches: 'production'
});

app.gitlab('/321-gitlab-hook');

http.createServer(app).listen(process.env.PORT || 3000);