var redis = require('../redis-db');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var pageSize = config['pageSize'] || 10;
var expireTime = parseFloat(config['feedCacheExpireTime']) * 60 * 60; 
var logger = require('log4js').getLogger('user-service');
var common = require('./common');

var self = this;
/*
    Feed Redis cache.
    Caches the latest article list subscribed by a user.
    Keys: 'feed-articles:' + userId
    Values: { "id": articleId, "userId": userId, "createTime": publishTime }

    If there is only one element in the array and is an string value of "0",
        it indicates there is no feeds for this user. (Not meaning it has not been cached)
        See setFeedList for more information.
    Therefore we should to take care of the "0" when modifying the cache list.
*/

var getFeedKey = function (userId, classifyId) {
    if (!classifyId || classifyId === 0)
        return 'feed-articles:' + userId;
    else
        return 'feed-articles:' + userId + ',classifyId:' + classifyId;
};

exports.getFeedListByUserId = function (userId, classifyId, startIndex, endIndex) {
    var feedKey = getFeedKey(userId, classifyId);

    return redis.existsAsync(feedKey).then(exists => {
        if (exists !== 1) {
            return null;
        }

        return redis.lrangeAsync(feedKey, startIndex, endIndex).then(list => {
            logger.trace('Attempting to fetch feed list from cache with result count: ' + (list ? list.length : 'null'));

            //Handles empty feed list
            if (list && ((list.length == 1 && list[0] === "0") || list.length == 0))
                return [];

            // If not setting this, the cache will be expired after a certain time.
            // Otherwise each time user access the feed list, the expire time resets.
            if (list) {  // && !config['processNewArticleOn']
                redis.expireAsync(feedKey, expireTime).then(res => {
                    //logger.trace('Set expire time: ' + res);
                }).catch(err => {
                    logger.trace('Set expire time failed for feed cache: ' + err);
                });
                
                return list;
            } else {
                return null;
            }
        });
    });
}

exports.setFeedList = function (userId, classifyId, articles) {
    var feedKey = getFeedKey(userId, classifyId);

    /*
        Because rpush does not allow an empty array, so we will have to find a workaround to identify no feed articles.
        An one element list with "0" in it indicates an empty list.
    */
    return redis.rpushAsync(feedKey, common.jsonifyArray(articles)).then(count => {
        return redis.expireAsync(feedKey, expireTime).then(res => {
            return count;
        });
    });
};

var removeFeedListInternal = function(feedKey) {
    return redis.delAsync(feedKey).then(count => {
        return count;
    });
}

/**
 * Removes all feed entries for the user to force a refresh.
 * This will be needed when user changes his subscription list.
 */
exports.removeFeedList = function (userId, classifyId) {
    // Note we have to delete all entries for the entire feed list (as well as the classified feed list).
    // Gets the unclassified feed key, this is also the prefix to the classified ones.
    var feedKeyPrefix = getFeedKey(userId, 0);
    
    return redis.keysAsync(feedKeyPrefix + '*').then(keys => {
        if (!keys || keys.length == 0)
            return;

        var deletePromises = [];
        keys.forEach(k => deletePromises.push(removeFeedListInternal(k)));

        return Q.all(deletePromises).then(results => {
            logger.trace('Deleted whole feed entries for user callback. Count = ' + results.length);
        });
    }).catch(err => {
        logger.error('Cannot delete the whole feed entries for user:' + err);
    });

    /*
    var feedKey = getFeedKey(userId, classifyId);

    return redis.delAsync(feedKey).then(count => {
        return count;
    });
    */
};

exports.addItemToFeedList = function (userId, feedItem) {
    throw new Error('Not implemented.');

    /*
    var feedKey = getFeedKey(userId);

    return redis.lpushxAsync(feedKey, JSON.stringify(feedItem)).then(count => {
        return count;
    }).catch(err => {
        logger.error('Failed to add new article to cache: ');
        return -1;
    });
    */
};

exports.removeItemFromFeedList = function (userId, feedItem) {
    
};
