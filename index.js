/*!
 * Gitlab Webhook Handler Middleware
 * Copyright(c) 2013 Nicholas Penree <nick@penree.com>
 * MIT Licensed
 */

'use strict';

var isArray = require('util').isArray;
var exec = require('child_process').exec;
var debug = require('debug')('gitlab-webhook');
var express = require('express');
var app = express.application;

var processCommand = function(cmd, params) {
  params = params || {};
  var re = /{{([{>?!#]*([\w.]*)(?:[:=~>\w.]+)?)}}(?:([\s\S]+?){{\/\2}})?/gm;
  var match;
  var keys = [];
  while ((match = re.exec(cmd))) keys.push(match[1]);
  if (keys.length) {
    keys.forEach(function(key) {
      var segs = key.split('.');
      var subparams = params;
      while (segs.length) {
        var subkey = segs.shift();
        subparams = subparams[subkey];
      }
      cmd = cmd.replace(new RegExp('{{' + key + '}}', 'g'), subparams);
    });
  }
  return cmd;
};

/**
 * Execute a command when an authenticated webhook POSTs for an allowed branch.
 *
 * Options:
 *   - param {String} name of parameter of token (default: token)
 *   - token {String} content of token to match (default: none)
 *   - branches {String|Array} list of branches to allow (default: *)
 *   - ips {String|Array} list of ip addresses to allow (default: 127.0.0.1)
 *   - exec {String} command to run if allowed (default: git pull <branch>)
 *
 * @param {String} route
 * @param {Options} opts
 * @return {Function}
 * @api public
 */

exports = module.exports = function(opts) {
  opts = opts || {};
  
  return function(req, res) {
    var param = opts.param || 'token';
    var token = req.param(param);
    var payload = req.body || {};
    var branches = opts.branches || ['*'];
    var ips = opts.ips || ['127.0.0.1'];
    var ref = payload.ref;
    var ip = req.ip;
    var cmd = opts.exec || 'git pull ' + ref;
    
    branches = isArray(branches)? branches : [branches];
    ips = isArray(ips)? ips : [ips];
    
    debug('new hook request from %s for %s', ip, ref);
    
    if (ips.indexOf('*') === -1 && ips.indexOf(ip) === -1) {
      debug('%s not found in allowed ips: %s', ip, ips.join(', '));
      res.status(404);
      return res.end();
    }
    
    if (token !== opts.token) {
      debug('%s "%s" does not match', param, token);
      res.status(404);
      return res.end();
    }
    
    if (branches.indexOf('*') === -1 && branches.indexOf(ref) === -1) {
      debug('%s not found in allowed branches: %s', ref, branches.join(', '));
      res.status(403);
      return res.end();
    }
    
    debug('%s branch allowed', ref);
    try {
      var cmd = processCommand(cmd, payload);
      debug('$ ' + cmd);
      exec(cmd, function(err, stdout, stderr) {
        if (err) {
          debug('execute failed: ' + err.message);
          res.send(500);
          return res.end();
        }
        
        if (stdout) debug('stdout: ' + stdout.trim());
        if (stderr) debug('stderr: ' + stderr.trim());
        
        res.send(200);
        return res.end();
      });
    } catch (err) {
      res.send(500);
      return res.end();
    }
  };
};

/**
 * Expose HTTP
 */

module.exports.http = function(opts) {
  opts = opts || {};
  return express().gitlab(opts.route || '/gitlab-hook', opts);
}
 
/**
 * Execute a command when an authenticated webhook POSTs for an allowed branch.
 *
 * Options:
 *   - param {String} name of parameter of token (default: token)
 *   - token {String} content of token to match (default: none)
 *   - branches {String|Array} list of branches to allow (default: *)
 *   - ips {String|Array} list of ip addresses to allow (default: 127.0.0.1)
 *   - exec {String} command to run if allowed (default: git pull <branch>)
 *
 * @param {String} route
 * @param {Options} opts
 * @return {Function}
 * @api public
 */

app.gitlab = function(route, opts) {
  return this.post(route, [express.bodyParser(), exports(opts)]);
};