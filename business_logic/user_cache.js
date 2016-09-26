var redis = require('../redis-db');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var expireTime = parseFloat(config['userCacheExpireTime']) * 60 * 60; 
var logger = require('log4js').getLogger('user-service');
var common = require('./common');

var self = this;

var getUserArticlesKey = function (userId, classifyId) {
    if (classifyId == 0 || classifyId == undefined) {
        return 'user-articles:' + userId;
    }
    return 'user-articles:' + userId + ',classifyId:' + classifyId;
};

var getUserInformationKey = function (userId) {
    return 'user:' + userId;
}

var getUserSubscribersCountKey = function (userId) {
    return 'user-subscribers-count:' + userId;
}

/*
    Gets the articles published by the user in the cache.

    If there is only one element in the array and is an string value of "0",
        it indicates there is no feeds for this user. (Not meaning it has not been cached)
        (Because Redis cannot keep an empty list)
    Therefore we should to take care of the "0" when modifying the cache list.

    Parameters: userId
                classifyId: if 0, fetches all articles for this user.
    Returns: An object array [{articleId, createTime}], or null (not empty list!) if not in cache.
*/
exports.getUserArticlesByUserId = function (userId, classifyId, startIndex, endIndex) {
    var key = getUserArticlesKey(userId, classifyId);

    return redis.existsAsync(key).then(exists => {
        if (exists !== 1)
            return null;

        return redis.lrangeAsync(key, startIndex, endIndex).then(list => {
            logger.trace('Attempting to fetch article list for a user with result count: ' + (list ? list.length : 'null'));

            //Handles empty list (cached but not articles)
            if (list && ((list.length == 1 && list[0] === "0") || list.length == 0))
                return [];

            if (list && config['processNewArticleOn']) {
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

exports.setUserArticlesList = function (userId, classifyId, articles) {
    var key = getUserArticlesKey(userId, classifyId);

    return redis.rpushAsync(key, common.jsonifyArray(articles)).then(count => {
        return redis.expireAsync(key, expireTime).then(res => {
            return count;
        });
    });
};

/**
 * Increase or descrease (if negative number provided) the subscribers count in the cache.
 * Returns: The subscribers count, or null if cache misses.
 */
exports.increaseUserSubscribersCount = function (userId, increment) {
    var key = getUserSubscribersCountKey(userId);

    return redis.existsAsync(key).then(exists => {
        if (exists !== 1) 
            return null;

        return redis.incrbyAsync(key, increment);
    });
};

/**
 * Gets the subscribers count of a user in the cache.
 * Returns: Subscribers count, or null if cache misses.
 */
exports.getUserSubscribersCount = function (userId) {
    var key = getUserSubscribersCountKey(userId);

    return redis.existsAsync(key).then(exists => {
        if (exists !== 1) 
            return null;

        return redis.getAsync(key);
    });
};

exports.setUserSubscriberCount = function (userId, subscribersCount) {
    var key = getUserSubscribersCountKey(userId);

    return redis.setexAsync(key, expireTime, subscribersCount);
};

exports.addArticleToUserArticlesList = function (userId, articleItem) {
    var key = getUserSubscribersCountKey(userId);

    return redis.lpushxAsync(key, JSON.stringify(feedItem)).then(count => {
        return count;
    }).catch(err => {
        logger.error('Failed to add new article to user cache: ');
    });
};

exports.setUserInformation = function (userId, information) {
    var key = getUserInformationKey(userId);
    return redis.setexAsync(key, expireTime, JSON.stringify(information)).then(count => {
        return count;
    }).catch(err => {
        logger.error('Failed to add new user information to cache: ' + err);
    });
};

exports.getUserInformation = function (userId) {
    var key = getUserInformationKey(userId);

    return redis.existsAsync(key).then(exists => {
        if (exists !== 1)
            return null;

        return redis.getAsync(key).then(information => {
            redis.expireAsync(key, expireTime).then(res => {
            }).catch(err => {
                logger.error('Set expire time failed for user information cache: ' + err);
            });

            return JSON.parse(information);
        });
    });

}