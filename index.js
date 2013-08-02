/*!
 * Gitlab Webook Handler Middleware
 * Copyright(c) 2013 Nicholas Penree <nick@penree.com>
 * MIT Licensed
 */

'use strict';

var util = require('util').isArray;
var exec = require('child_process').exec;
var debug = require('debug')('gitlab-webook-handler')

exports = module.exports = function(opts) {
  return function(req, res) {
    var param = opts.param || 'token';
    var token = req.param(param);
    var payload = req.body || {};
    var branches = opts.branches || [];
    
    if (token !== opts.token) {
      debug('%s "%s" does not match, denying access', param, token);
      return res.status(403);
    }
    
    branches = isArray(branches)? branches : [branches];
    
    if (branches.indexOf('*') === -1 || branches.indexOf(payload.ref) === -1) {
      debug('%s not found in allowed branches: %s', branches.join(', '));
      return res.status(403);
    }
    
    debug('%s allowed', payload.ref);
    exec('git pull ' + payload.ref, function() {
      res.send(200);
    });
  };
};