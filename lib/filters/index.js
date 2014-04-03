
var isArray = require('util').isArray
  , ASSERT = require('assert');

// api
module.exports = {
  ips      : ipsFilterMiddlewareGenerator,
  token    : tokenFilterMiddlewareGenerator,
  branches : branchesFilterMiddlewareGenerator
};

/**
 * Generate filter by ip middleware
 * @param {Object} opts
 *   - {String|String[]|Function} ips
 * @param {Function=} fail
 * @returns {Function} express middleware
 * @todo add complex network and wildcard tests
 */
function ipsFilterMiddlewareGenerator (opts, fail) {
  ASSERT(opts && opts.ips);
  fail = skipRouteIfEmpty(fail);

  var filter = makeSimpleFilter(opts.ips);

  return function (req, res, next) {
    filter(req.ip)? next() : fail(req, res, next);
  };
}

/**
 * Generate filter by token and req.body[tokenKey] middleware
 * @param {Object} opts
 *   - {String|String[]|Function} token
 *   - {String} [tokenKey=token]
 * @param {Function=} fail
 * @returns {Function} express middleware
 */
function tokenFilterMiddlewareGenerator (opts, fail) {
  ASSERT(opts && opts.token && opts.tokenKey);
  fail = skipRouteIfEmpty(fail);

  var filter = makeSimpleFilter(opts.token)
    , tokenKey = opts.tokenKey;

  return function (req, res, next) {
    filter(req.param(tokenKey))? next() : fail(req, res, next);
  };
}

/**
 * Generate filter by branch (ref) middleware
 * @param {Object} opts
 *   - {String|String[]|Function} branches
 * @param {Function=} fail
 * @returns {Function} express middleware
 */
function branchesFilterMiddlewareGenerator (opts, fail) {
  ASSERT(opts && opts.branches);
  fail = skipRouteIfEmpty(fail);

  var filter = makeSimpleFilter(opts.branches);

  return function (req, res, next) {
    filter(req.body.ref)? next() : fail(req, res, next);
  };
}

/**
 * skipRoute express middleware
 * @param {http.ClientRequest} req
 * @param {http.ServerResponse} res
 * @param {Function} next
 */
function skipRouteMiddleware (req, res, next) {
  next('route');
}

/**
 * Simple list filter generator
 * @param {Function|String|String[]} list - callback or list
 * @returns {Function} filter
 */
function makeSimpleFilter (list) {
  if (typeof list === 'function') {
    return list;
  }
  if (isArray(list)) {
    return function (item) {
      return list.indexOf(item) !== -1;
    };
  }
  return function (item) {
    return list === item;
  };
}

/**
 * Tiny helper
 * @param {Function=} fn
 * @returns {Function}
 */
function skipRouteIfEmpty (fn) {
  if (fn && fn.call) {
    return fn;
  }
  return skipRouteMiddleware;
}
