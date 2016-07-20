var redis = require('redis');
var redisClient = redis.createClient(config['redis-connection'][current_env]);

redisClient.on('ready', res => {
  log4jslogger.trace('Connected to Redis server.');
});

redisClient.on('error', err => {
  log4jslogger.trace('Connected to Redis server failed. ' + err);
})

module.exports = redisClient;