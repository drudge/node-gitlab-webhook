/*!
 * Gitlab Webhook Handler Middleware
 * Copyright(c) 2013 Nicholas Penree <nick@penree.com>
 * MIT Licensed
 */

'use strict';

var isArray = require('util').isArray;
var spawn = require('child_process').spawn;
var createWriteStream = require('fs').createWriteStream;
var debug = require('debug')('gitlab-webhook');
var express = require('express');
var app = express.application;

/**
 * Given a string `cmd`, replace all values in {{}} with the matching value.
 *
 * An object is returned with two keys:
 * 
 *  - `cmd` {String} The base command to execute
 *  - 'args' {Array} Any arguments to pass to the `cmd`
 *
 * @param {String} cmd
 * @param {Object} params
 * @return {Object}
 * @api private
 */

var prepareCommand = function(cmd, params) {
  params = params || {};
  var re = /{{([^{{}}]+)}}/gm;
  var match;
  var keys = [];
  while ((match = re.exec(cmd))) keys.push(match[1]);
  if (keys.length) {
    keys.forEach(function(key) {
      var segs = key.split('.');
      var sub = params;
      while (segs.length) sub = sub[segs.shift()];
      cmd = cmd.replace(new RegExp('{{' + key + '}}', 'mg'), sub);
    });
  }
  var comps = cmd.split(' ');
  return {
    cmd: comps.shift(),
    args: comps
  };
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
 *   - log {String} path of file to log output of execution to (default: ./logs/deploy.log)
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
    var log = opts.log || './logs/deploy.log';
    
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
      var run = prepareCommand(cmd, payload);
      var out = createWriteStream(log, { flags: 'a', encoding: 'utf8' });
      debug('$ ' + run.cmd + ' ' + run.args.join(' '));
      out.once('error', function(err) {
        debug('error: ' + err.message);
        res.send(500);
        return res.end();
      });
      out.once('open', function() {
        var child = spawn(run.cmd, run.args, {
          detached: true,
          stdio: [ 'ignore', out, out ]
        });
        child.unref();
        res.send(200);
        return res.end();
      });
    } catch (err) {
      debug('error: ' + err.message);
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
 *   - log {String} path of file to log output of execution to (default: ./logs/deploy.log)
 *
 * @param {String} route
 * @param {Options} opts
 * @return {Function}
 * @api public
 */

app.github =
app.gitlab = function(route, opts) {
  return this.post(route, [express.bodyParser(), exports(opts)]);
};