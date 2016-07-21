var bluebird = require('bluebird');
var redis = require('redis');
var path = require('path');
var log4js = require('log4js');
var log4jslogger = log4js.getLogger('user-service');
var current_env = process.env.NODE_ENV || "development";
var config = require(path.join(__dirname, 'config', 'config.json'));
var redisConfig = config['redis-connection'][current_env];
redisConfig.retry_strategy = function (options) {
  if (options.error.code === 'ECONNREFUSED') {
    // End reconnecting on a specific error and flush all commands with a individual error
     log4jslogger.error('Redis server: The server refused the connection.');
    return new Error('The server refused the connection');
  }
  if (options.total_retry_time > 1000 * 10) {
    // End reconnecting after a specific timeout and flush all commands with a individual error
    log4jslogger.error('Redis server: Retry time exhausted.');
    return new Error('Retry time exhausted');
  }
  if (options.times_connected > 2) {
    // End reconnecting with built in error
    return undefined;
  }
  // reconnect after
  return Math.max(options.attempt * 100, 3000);
}
var redisClient = redis.createClient(redisConfig);

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

redisClient.on('ready', res => {
  log4jslogger.trace('Connected to Redis server.');
});

redisClient.on('error', err => {
  log4jslogger.error('Connected to Redis server failed. ' + err);
})

module.exports = redisClient;