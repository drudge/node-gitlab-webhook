# Gitlab Webhook Handler Middleware for Express

### Install

    > npm i gitlab-webhook-handler
    
### Usage

```javascript
var express = require('express');
var webhook = require('gitlab-webhook-handler');
...
var app = express();

app.use(express.bodyParser());
app.use(express.methodOverride());
...
app.post('/123-gitlab-hook', webhook({
  exec: 'jake deploy',
  token: 'CA572F1C-7BEB-467E-B26F-8999AB09CD4C',
  branches: '*'
}));

http.createServer(app).listen(3000);
```