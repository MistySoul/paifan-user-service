var models = require('../models');
var sequelize = require('../models/index').sequelize;
var feedCache = require('./feed_cache');
var logger = require('log4js').getLogger('user-service');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var pageSize = config['pageSize'];
var maxFeedCount = config['maxFeedCount'];
var meta = require('../config/metadata.json')['old_db'];
var approvedArticleStatus = meta['approved-article-status-id'];

var self = this;

/*
    Gets the latest articles list (ids) subscribed by a user.
    Currently we only support a certain amounts of articles, 
        this avoids to process the older articles in the cache when pageNumber increases and make things easier.
    In the furture we could improve this.
*/
exports.getFeedListByUserId = function (userId, pageNumber) {
    var startIndex = pageSize * pageNumber;

    return feedCache.getFeedListByUserId(userId, startIndex, startIndex + pageSize - 1).then(res => {
        if (res)  // If no cache, res will be null. If res.length = 0, no feeds avaiable
            // If cache hits, simply return.
            return res;
        else {
            // No cache avaiable, search in DB.
            return self.getFeedsFromDb(userId, 0, maxFeedCount).then(feeds => {
                feedCache.setFeedList(userId, feeds).then(res => {
                    logger.trace('Feed list for user id: ' + userId + ' successfully wrote to cache with count: ' + feeds.length);
                    return getRangeOfArray(feeds, startIndex, startIndex + pageSize - 1);
                }).catch(err => {
                    logger.error('Feed list for user id: ' + userId + ' FAILED: ' + err);
                    return getRangeOfArray(feeds, startIndex, startIndex + pageSize - 1);
                });
            });
        }
    }).catch(err => {
        // There is an error while accessing the cache, log it and search in DB
        logger.error('Failed to get feed list from cache: ' + err);
        return self.getFeedsFromDb(userId, 0, maxFeedCount).then(feeds => {
            return getRangeOfArray(feeds, startIndex, startIndex + pageSize - 1);
        });
    });
};

/*
    Run a SQL to get the feed list.
    In the future, we'll search datas in UserPublish table to seperate Articles and Users storage.
*/
var getFeedsRawQuery = `
SELECT a.id, a.author, a.createTime FROM UserFeed uf
    INNER JOIN suit AS a ON a.author = uf.feedUserId
WHERE
    uf.userId = ? AND a.auditStatus = ?
ORDER BY a.createTime DESC
LIMIT ?, ?
`;
exports.getFeedsFromDb = function (userId, startIndex, count) {
    return sequelize.query(getFeedsRawQuery, {
        replacements: [userId, approvedArticleStatus, startIndex, count],
        type: sequelize.QueryTypes.SELECT
    }).then(results => {
        return results;
    });
}

exports.getFeededUsersByUserId = function (userId) {
    return models.UserFeed.findAll({
        attributes: ['feedUserId'],
        where: {
            userId: userId
        },
        order: 'feedUserId'
    }).then(users => {
        var idArray = [];
        users.forEach(user => { idArray.push(user.feedUserId); }, this);
        return idArray;
    });
};

exports.subscribeUser = function (userId, subscribeUserId) {
    return models.UserFeed.findOrCreate({
        where: {
            userId: userId,
            feedUserId: subscribeUserId
        }
    }).spread((userFeed, created) => {
        return created;
    });
}

exports.unsubscribeUser = function (userId, subscribeUserId) {
    return models.UserFeed.destroy({
        where: {
            userId: userId,
            feedUserId: subscribeUserId
        }
    }).then(count => {
        return count;
    });
}

var getRangeOfArray = function(array, startIndex, endIndex) {
    var result = [];

    if (array == null)
        return result;

    for (var i = startIndex; i < endIndex && i < array.length; i++)
        result.push(array[i]);

    return result;
}