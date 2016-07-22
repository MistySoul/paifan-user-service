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
                return getRangeOfArray(res, 0, res.length - 1, true);
            }
        else {
            // No cache avaiable, search in DB.
            return self.getFeedsFromDb(userId, 0, maxFeedCount).then(feeds => {
                feedCache.setFeedList(userId, feeds).then(res => {
                    logger.trace('Feed list for user id: ' + userId + ' successfully wrote to cache with count: ' + feeds.length);
                }).catch(err => {
                    logger.error('Feed list for user id: ' + userId + ' FAILED: ' + err);
                });

                return getRangeOfArray(feeds, startIndex, startIndex + pageSize - 1);
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
};

/*
    This is an internal method to fetch the summaries of articles.
    It will first search them in cache, and get the uncached articles from the Article Service and caches them.
    TO-DO: Handle caches are not avaiable. Perhaps simple call the Article Service to get the summaries.
*/
exports.getArticlesSummary = function (articleCacheArray) {
    var summaries = [];
    var cachePromises = [];
    
    // Note we will have to keep the return values as the same order in the cache,
    // the index parameter is used to store the position in the cache. 
    // Not necessary, the promise library will give the results in order!
    articleCacheArray.forEach((t, index, array) => cachePromises.push(articleCache.getArticleSummaryByArticleId(t.id, index)), self);

    return Q.all(cachePromises).then(results => {
        // Some of the articles may not be cached, therefore we need to request them from the Article Service.
        var uncachedArticleIds = [];
        
        results.forEach(r => {
            if (r.summary != null) {
                // In cache, write it to the cache object
                articleCacheArray[r.mark].summary = r.summary;
                // The mark is unnecessary! The results are already been sorted by Q library!!!
            } else {
                uncachedArticleIds.push(articleCacheArray[r.mark].id);
            }
        }, this);

        logger.trace('Got summary of the articles from the cache, ' + uncachedArticleIds + ' articles are not in cache.');

        //Send a request to the Article Service to get the summary of uncached articles.
        if (uncachedArticleIds.length > 0) {
            return articleService.requestArticlesSummary(uncachedArticleIds).then(summaries => {
                var cacheWritePromises = [];
                // Put the articles to the cache
                summaries.forEach(s => {
                    cacheWritePromises.push(articleCache.setArticleSummary(s, s.id));

                    // Place it to the result array
                    for (var i = 0; i < articleCacheArray.length; i++) {
                        if (s.id == articleCacheArray[i].id) {
                            articleCacheArray[i].summary = s;
                            break;
                        }
                    }
                });

                Q.all(cacheWritePromises).then(results => {
                    logger.trace('Wrote summary of ' + results.length + ' articles to the cache.');
                }).catch(err => {
                    logger.error('Error writing articles summary to the cache: ' + err);
                });

                return articleCacheArray;
            });
        } else  {
            // All articles in cache, simply return.
            return articleCacheArray;
        }
            
    }).catch(err => {
        logger.error('Error while get article summaries: ' + err);
        throw err;
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
    self.getSubscribingUsersIdByUserId(article.author).then(users => {
        
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

var getRangeOfArray = function(array, startIndex, endIndex, deserializeJson) {
    var result = [];

    if (array == null)
        return result;

    if (deserializeJson) {
        for (var i = startIndex; i <= endIndex && i < array.length; i++) 
            result.push(JSON.parse(array[i]));
    } else {
        for (var i = startIndex; i <= endIndex && i < array.length; i++) 
            result.push(array[i]);
    }

    return result;
};