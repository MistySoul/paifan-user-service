var redis = require('../redis-db');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var pageSize = config['pageSize'] || 10;
var expireTime = parseInt(config['userCacheExpireTime']) * 60 * 60; 
var logger = require('log4js').getLogger('user-service');

var self = this;
/*
    Feed Redis cache.
    Caches the latest article list subscribed by a user.
    Keys: 'feed-articles:' + userId
    Values: { "id": articleId, "uid": userId, "t": publishTime }

    If there is only one element in the array and is an string value of "0",
        it indicates there is no feeds for this user. (Not meaning it has not been cached)
        See setFeedList for more information.
    Therefore we should to take care of the "0" when modifying the cache list.
*/

var getFeedKey = function (userId) {
    return 'feed-articles:' + userId;
};

exports.getFeedListByUserId = function (userId, startIndex, endIndex) {
    var feedKey = getFeedKey(userId);

    return redis.existsAsync(feedKey).then(exists => {
        if (exists !== 1) {
            return null;
        }

        return redis.lrangeAsync(feedKey, startIndex, endIndex).then(list => {
            logger.trace('Attempting to fetch feed list from cache with result count: ' + (list ? list.length : 'null'));

            //Handles empty feed list
            if (list && ((list.length == 1 && list[0] === "0") || list.length == 0))
                return [];

            if (list) {
                return redis.expireAsync(feedKey, expireTime).then(res => {
                    logger.trace('Set expire time: ' + res);
                    return list;
                });
            } else {
                return null;
            }
        });
    });
}

exports.setFeedList = function (userId, articles) {
    var feedKey = getFeedKey(userId);

    /*
        Because rpush does not allow an empty array, so we will have to find a workaround to identify no feed articles.
        An one element list with "0" in it indicates an empty list.
    */
    return redis.rpushAsync(feedKey, jsonifyArray(articles)).then(count => {
        return redis.expireAsync(feedKey, expireTime).then(res => {
            return count;
        });
    });
};

var jsonifyArray = function (array) {
    var result = [];

    if (array == null || array.length == 0) {
        result.push("0");
        return result;
    }

    for (var i = 0; i < array.length; i++) {
        result.push(JSON.stringify(array[i]));
    }

    return result;
};