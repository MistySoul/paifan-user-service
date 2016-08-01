var models = require('../models');
var sequelize = require('../models/index').sequelize;
var feedCache = require('./feed_cache');
var articleCache = require('./article_cache');
var articleService = require('../interfaces/article_service_interface');
var logger = require('log4js').getLogger('user-service');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var pageSize = config['pageSize'];
var maxFeedCount = config['maxFeedCount'];
var meta = require('../config/metadata.json')['old_db'];
var approvedArticleStatus = meta['approved-article-status-id'];
var Q = require('q');
var common = require('./common');

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
            if (res.length == 0) {
                return [];
            } else {
                return common.getRangeOfArray(res, 0, res.length - 1, true);
            }
        else {
            // No cache avaiable, search in DB.
            return self.getFeedsFromDb(userId, 0, maxFeedCount).then(feeds => {
                feedCache.setFeedList(userId, feeds).then(res => {
                    logger.trace('Feed list for user id: ' + userId + ' successfully wrote to cache with count: ' + feeds.length);
                }).catch(err => {
                    logger.error('Set feed list cache for user id: ' + userId + ' FAILED: ' + err);
                });

                return common.getRangeOfArray(feeds, startIndex, startIndex + pageSize - 1);
            });
        }
    }).catch(err => {
        // There is an error while accessing the cache, log it and search in DB
        logger.error('Failed to get feed list from cache: ' + err);
        return self.getFeedsFromDb(userId, startIndex, pageSize).then(feeds => {
            return common.getRangeOfArray(feeds, 0, pageSize - 1);
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
LIMIT ?, ?;
`;
exports.getFeedsFromDb = function (userId, startIndex, count) {
    return sequelize.query(getFeedsRawQuery, {
        replacements: [userId, approvedArticleStatus, startIndex, count],
        type: sequelize.QueryTypes.SELECT
    }).then(results => {
        return results;
    });
};

/*
    Get all authors a user has been suscribed.
    Returns: Id array of the users.
*/
exports.getFeededUsersIdByUserId = function (userId) {
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

/*
    Get all subscribers of an author.
    Returns: An array of user object (only contains the userId).
*/
exports.getSubscribingUsersByUserId = function (userId) {
    return models.UserFeed.findAll({
        attributes: ['userId'],
        where: {
            feedUserId: userId
        }
    }).then(users => {
        return users;
    });
};

/*
    This will update the user feed cache for all users that has subscribed the article's author.
     * This may result a performance issue if this author has MANY subscribers.
       In the furture we will use a message queue and find a better way to update the cache (maybe a seperate low priority background process).
*/
exports.processNewArticlePublished = function (article) {
    return self.getSubscribingUsersByUserId(article.author).then(users => {
        if (users == null || users.length == 0)
            return 0;

        users.forEach(user => {
            // Just push the promises and directly return.
            feedCache.addItemToFeedList(users.userId, article).then(result => {
            });
        }, this);

        return 1;
    });
};

/*
    Called when an existing article has been deleted or inactive for some reason.
    This will update the user feed cache for all users that has subscribed the article's author to remove this article.
*/
exports.processArticleRemove = function (article) {

}

/*
    For subscribe/unsubscribe a user, now we simply remove the cache to force it reload on the next request.
*/

exports.subscribeUser = function (userId, subscribeUserId) {
    return models.UserFeed.findOrCreate({
        where: {
            userId: userId,
            feedUserId: subscribeUserId
        }
    }).spread((userFeed, created) => {
        feedCache.removeFeedList(userId).then(count => {
            logger.trace('Removed user feed cache for userId: ' + userId);
        }).catch(err => {
            logger.error('Error while removing user feed cache: ' + err);
        });

        return created;
    });
};

exports.unsubscribeUser = function (userId, subscribeUserId) {
    return models.UserFeed.destroy({
        where: {
            userId: userId,
            feedUserId: subscribeUserId
        }
    }).then(count => {
        feedCache.removeFeedList(userId).then(count => {
            logger.trace('Removed user feed cache for userId: ' + userId);
        }).catch(err => {
            logger.error('Error while removing user feed cache: ' + err);
        });

        return count;
    });
};

/**
 * After a subscribing/unsubscribing operation is processed,
 * refresh the subscribing count of a user in the cache.
 */
var updateSubscribingCount = function (userId) {
    
}

/**
 * Gets the number of subscribers of this user.
 */
exports.getSubscribingUsersCountFromDb = function (userId) {
    return models.UserFeed.findAll({
        attributes: [[sequelize.fn('COUNT', sequelize.col('userId')), 'c_user']],
        where: {
            feedUserId: userId
        }
    }).then(result => {
        return result.c_user;
    });
};