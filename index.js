/*!
 * Gitlab Webhook Handler Middleware
 * Copyright(c) 2013 Nicholas Penree <nick@penree.com>
 * MIT Licensed
 */

'use strict';

var isArray = require('util').isArray
  , createWriteStream = require('fs').createWriteStream
  , ASSERT = require('assert')

  , debug = require('debug')('gitlab-webhook')

  , runner = require('./lib/runner')
  , filters = require('./lib/filters');

// legacy
// module.exports = classicExports;
// clean
module.exports = api;

/**
 * Provides helper to simplify routes declarations
 * @param {Object} opts
 *   - {Array|Function} [ips='127.0.0.1'] - remote ip addresses filter
 *   - {Array|Function} [branches=false] - refs filter
 *   - {String} [tokenKey="token"] - param field name with security token
 *   - {String|String[]} [token=false] - valid token values
 *   - {boolean} [strict=false] - returns 403 error if some of filters failed
 */
function api (opts) {
  opts = opts || {};

  // prepare common data
  var ips      = ('ips' in opts)? ips : ['127.0.0.1']
    , branches = opts.branches || false
    , token    = opts.token || false
    , tokenKey = opts.tokenKey || 'token'
    , webhookKey = opts.webhookKey || 'webhook';

  // prepare outgoing middlewares array
  var middlewares = [];

  // add needed filters
  if (ips) {
    debug('Adding ips filter: %s', ips);
    middlewares.push(filters.ips({ips: ips}, opts.strict && fail));
  }

  if (token) {
    debug('Adding tokens filter: %s', token);
    middlewares.push(filters.token({tokenKey: tokenKey, token: token}, opts.strict && fail));
  }

  if (branches) {
    debug('Adding branches filter: %s', branches);
    middlewares.push(filters.branches({branches: branches}));
  }

  ASSERT(middlewares.length, "Invalid webhook configuration. Need some filters to apply handler");

  middlewares.push(function (req, res, next) {
    if (!req.body) {
      next('route');
    }

    req[webhookKey] = unifyBodyData(req.body);

    next();
  });

  if (opts.exec) {
    // add common middleware to patch objects
    middlewares.push(function (req, res, next) {
      try {
        var runnerOpts = runner.prepareCommand(opts.exec, req[webhookKey]);
        if (opts.execLog) {
          runnerOpts.outStream = createWriteStream(runner.prepareLogFile(opts.execLog, req[webhookKey]));
        }
        debug('$ ' + runnerOpts.cmd + ' ' + runnerOpts.args.join(' '));

        runner.run(runnerOpts, function (err, result) {
          /*jshint unused:false*/
          if (err) {
            debug('error: ' + err.message);
            res.send(500);
            return res.end();
          }
          next();
        });

      } catch (err) {
        debug('error: ' + err.message);
        res.send(500);
        return res.end();
      }
    });
  }

  return middlewares;
}

// default fail express middleware function
function fail (req, res, next) {
  /*jshint unused:false*/
  res.send(403);
  return res.end();
}

/**
 * reads and unifies push payloads and gitlab hook data
 * @param {Object} body - incoming data
 * @returns {Object} unified webhook data
 *   - {String} kind - kind or event
 *   - {}
 */
function unifyBodyData (b) {
  var data = {}, obj;

  switch (true) {
  case b.object_kind === 'issue':
  case b.object_kind === 'merge_request':
    data.kind    = b.object_kind;
    data.object  = obj = b.object_attributes;
    data.state   = obj.state;
    data.user_id = obj.author_id;

    data.object_kind = b.object_kind;
    data.object_attributes = b.object_attributes;
    break;

  case b.ref && b.repository && true:
    var refa = b.ref.split(/\//)
      , refName = refa.slice(2).join('/')
      , tag    = refa[1] === 'tags'? refName : null
      , branch = refa[1] === 'heads'? refName : null
      , empty0 = Number(b.before) === 0
      , empty1 = Number(b.after) === 0;

    data.kind   = 'push';

    // additional
    data.action = (empty0 && 'create') || (!empty0 && !empty1 && 'update') || (empty1 && 'delete');
    data.entity = (tag && 'tag') || (branch && 'branch') || ('unknown');
    data.event  = [data.action, data.entity].join('-');

    // primary data
    data.branch  = branch;
    data.tag     = tag;
    data.treeish = empty1? null : b.after;
    data.ref     = data.branch || data.tag || null;
    data.user_id = b.user_id;
    data.object  = data.payload = b;
    break;

  default:
    data.kind   = 'unknown';
    data.object = b;
  }
  return data;
}

// legacy version: patching globals
(function (express) {
  var app = express.application;

  /**
   * Expose HTTP
   * @param {Object=} opts
   *   - {Object} route
   */
  module.exports.http = function(opts) {
    opts = opts || {};
    return express().gitlab(opts.route || '/gitlab-hook', opts);
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
  app.github =
  app.gitlab = function(route, opts) {
    return this.post(route, [express.bodyParser(), classicExports(opts)]);
  };
}(require('express')));

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
function classicExports (opts) {
  opts = opts || {};

  // prepare common data
  var param    = opts.param || 'token'
    , branches = opts.branches || ['*']
    , ips      = opts.ips || ['127.0.0.1']
    , log      = opts.log || './logs/deploy.log';

  branches = isArray(branches)? branches : [branches];
  ips = isArray(ips)? ips : [ips];

  // return prepared express middleware function
  return function (req, res) {
    var token    = req.param(param)
      , payload  = req.body || {}
      , ref      = payload.ref
      , ip       = req.ip
      , cmd      = opts.exec || ('git pull ' + ref);

    debug('new hook request from %s for %s', ip, ref);

    // filter by ip
    if (ips.indexOf('*') === -1 && ips.indexOf(ip) === -1) {
      debug('%s not found in allowed ips: %s', ip, ips.join(', '));
      res.send(404);
      return res.end();
    }

    // filter by gitlab token value
    if (token !== opts.token) {
      debug('%s "%s" does not match', param, token);
      res.send(404);
      return res.end();
    }

    // filter by branches
    if (branches.indexOf('*') === -1 && branches.indexOf(ref) === -1) {
      debug('%s not found in allowed branches: %s', ref, branches.join(', '));
      res.send(403);
      return res.end();
    }

    // execute command
    debug('%s branch allowed', ref);
    try {
      var runnerOpts = runner.prepareCommand(cmd, payload);
      runnerOpts.outStream = createWriteStream(log);
      debug('$ ' + runnerOpts.cmd + ' ' + runnerOpts.args.join(' '));

      runner.run(runnerOpts, function (err, result) {
        /*jshint unused:false*/
        if (err) {
          debug('error: ' + err.message);
          res.send(500);
          return res.end();
        }
        res.send(200);
        return res.end();
      });
    } catch (err) {
      debug('error: ' + err.message);
      res.send(500);
      return res.end();
    }
  };
}
