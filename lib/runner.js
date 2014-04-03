
var ASSERT = require('assert')
  , SPAWN = require('child_process').spawn;

module.exports = {
  prepareCommand : prepareCommand,
  prepareLogFile : prepareLogFile,
	run            : run
};

/**
 * Given a string `cmd`, replace all values in {{}} with the matching value.
 *
 * An object is returned with two keys:
 *
 *  - `cmd` {String} The base command to execute
 *  - 'args' {Array} Any arguments to pass to the `cmd`
 *
 * @param {String} cmd
 * @param {Object=} params
 * @returns {{cmd: String, args: String[]}}
 * @api public
 */
function prepareCommand (cmd, params) {
  params = params || {};

  cmd = prepare(cmd, params);

  return {
    cmd: 'sh',
    args: ['-c', cmd]
  };
}

function prepareLogFile (str, params) {
  return prepare(str, params);
}

var re = /{{([^{{}}]+)}}/gm
  , keyReCache = {};

function prepare (str, params) {
  var match
    , keys = []
    , values = {};

  if (str.call) {
    str = str(params);
  }

  re.lastIndex = 0;
  while ((match = re.exec(str))) {
    keys.push(match[1]);
  }

  if (keys.length) {
    Object.keys(params).forEach(function (k) {
      values[k] = params[k];
    });
    Object.keys(params.payload).forEach(function (k) {
      values[k] = params.payload[k];
    });
    keys.forEach(function(key) {
      var segs = key.split('.');
      var sub = values;
      while (segs.length) {
        sub = sub[segs.shift()];
      }
      keyReCache[key] = keyReCache[key] || new RegExp('{{' + key + '}}', 'mg');
      str = str.replace(keyReCache[key], sub);
    });
  }

  return str;
}

/**
 * Run command
 * @param {Object} opts
 *   - {String} cmd
 *   - {String[]} [args=]
 *   - {stream.Writable} outStream
 * @param {Function} cb
 */
function run (opts, cb) {
  ASSERT(opts && opts.cmd);
  ASSERT(cb);
  opts = opts || {};
  opts.args = opts.args || [];

  if (!opts.outStream) {
    _spawnDetached(opts.cmd, opts.args, 'ignore');
    return;
  }

  opts.outStream
    .once('error', cb)
    .once('open', function () {
      _spawnDetached(opts.cmd, opts.args, opts.outStream);
    });

  function _spawnDetached (cmd, args, out) {
    var child = SPAWN(cmd, args, {
      detached: true,
      stdio: [ 'ignore', out, out ]
    });
    child.unref();
    cb(null, {child: child});
  }

}
