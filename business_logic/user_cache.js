var redis = require('../redis-db');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var expireTime = parseInt(config['userCacheExpireTime']) * 60 * 60; 
var logger = require('log4js').getLogger('user-service');
var common = require('./common');

var self = this;

var getUserArticlesKey = function (userId) {
    return 'user-articles:' + userId
};

/*
    Gets the articles published by the user in the cache.

    If there is only one element in the array and is an string value of "0",
        it indicates there is no feeds for this user. (Not meaning it has not been cached)
        (Because Redis cannot keep an empty list)
    Therefore we should to take care of the "0" when modifying the cache list.

    Parameters: userId
    Returns: An object array [{articleId, createTime}], or null (not empty list!) if not in cache.
*/
exports.getUserArticlesByUserId = function (userId, startIndex, endIndex) {
    var key = getUserArticlesKey(userId);

    return redis.existsAsync(key).then(exists => {
        if (exists !== 1)
            return null;

        return redis.lrangeAsync(key, startIndex, endIndex).then(list => {
            logger.trace('Attempting to fetch article list for a user with result count: ' + (list ? list.length : 'null'));

            //Handles empty list (cached but not articles)
            if (list && ((list.length == 1 && list[0] === "0") || list.length == 0))
                return [];

            if (list) {
                redis.expireAsync(key, expireTime).then(res => {
                    // don't care
                }).catch(err => {
                    logger.trace('Set expire time failed for feed cache: ' + err);
                });

                return list;
            } else {
                return null;
            }
        });
    });
};

exports.setUserArticlesList = function (userId, articles) {
    var key = getUserArticlesKey(userId);

    return redis.rpushAsync(key, common.jsonifyArray(articles)).then(count => {
        return redis.expireAsync(key, expireTime).then(res => {
            return count;
        });
    });
};

exports.addArticleToUserArticlesList = function (userId, articleItem) {
    var key = getUserArticlesKey(userId);

    return redis.lpushxAsync(key, JSON.stringify(feedItem)).then(count => {
        return count;
    }).catch(err => {
        logger.error('Failed to add new article to user cache: ');
    });
}
