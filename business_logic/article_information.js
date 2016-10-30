var models = require('../models');
var sequelize = require('../models/index').sequelize;
var userCache = require('./user_cache');
var articleCache = require('./article_cache');
var articleService = require('../interfaces/article_service_interface');
var logger = require('log4js').getLogger('user-service');
var meta = require('../config/metadata.json')['old_db'];
var approvedArticleStatus = meta['approved-article-status-id'];
var Q = require('q');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var pageSize = config['pageSize'];
var common = require('./common');
var userInformation = require('./user_information');

var self = this;

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
                var feedPictureQueryString = config['feedPictureUrlQueryString'];
                var avatarQueryString = config['feedAuthorAvatarUrlQueryString'];

                var cacheWritePromises = [];
                // Put the articles to the cache
                summaries.forEach(s => {
                    // Add an query string to the picture url to reduce picture size.
                    if (s.cover) 
                        s.cover += feedPictureQueryString;
                    
                    if (s.authorAvatar) 
                        s.authorAvatar += avatarQueryString;
                    
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
            
    }).then(articleCacheArray => {
        var summaries = [];
        // Some article summary may be avaiable for some reason, just ignore it.
        articleCacheArray.forEach(c => { if (c) summaries.push(c.summary); }, this);

        return summaries;
    }).catch(err => {
        logger.error('Error while get article summaries: ' + err);
        throw err;
    });
};

/**
 *  Gets the latest articles (only ids) published by the user.
 *  This will only include approved articles and sort them by last approved time. (For app use only currently)
 *  
 *  Steps:
 *      1. Search the list in the user cache, if hits, simple return.
 *      2. If not in cache, search it in DB (max 500 articles) to get the ids and save it in cache.
*/
exports.getUserArticles = function (userId, classifyId, pageNumber) {
    classifyId = classifyId || 0;
    pageNumber = parseInt(pageNumber);

    var startIndex = pageNumber * pageSize;
    
    return userCache.getUserArticlesByUserId(userId, classifyId, startIndex, startIndex + pageSize - 1).then(articles => {
        if (articles != null)  // Cache hits, return it.
            return common.getRangeOfArray(articles, 0, articles.length - 1, true);
        else {
            //Search in DB and store it in cache. Hard code the count now...
            return self.getUserArticlesFromDb(userId, classifyId, 0, 500).then(articles => {
                userCache.setUserArticlesList(userId, classifyId, articles).then(res => {
                    logger.trace('User article list for user id: ' + userId + ' successfully wrote to cache with count: ' + articles.length);
                }).catch(err => {
                    logger.error('Set article list cache for user id: ' + userId + ' FAILED: ' + err);
                });

                return common.getRangeOfArray(articles, startIndex, startIndex + pageSize - 1);
            });
        }
    }).catch(err => {
        // There is an error while accessing the cache, log it and search in DB
        logger.error('Failed to get article list from cache: ' + err);
        return self.getUserArticlesFromDb(userId, classifyId, startIndex, pageSize).then(articles => {
            return common.getRangeOfArray(articles, 0, pageSize - 1);
        });
    });
};

/**
 * Gets the completed articles for a specified user (including Pending and Rejected), order them by published time.
 */
exports.getCompletedUserArticlesByPublishTime = function (userId, classifyId, pageNumber) {
    classifyId = classifyId || 0;
    pageNumber = parseInt(pageNumber);

    var startIndex = pageNumber * pageSize;
    
    return userCache.getUserArticlesByUserId(userId, classifyId, startIndex, startIndex + pageSize - 1, "completed").then(articles => {
        if (articles != null)  // Cache hits, return it.
            return common.getRangeOfArray(articles, 0, articles.length - 1, true);
        else {
            //Search in DB and store it in cache. Hard code the count now...
            return self.getUserArticlesByPublishTime(userId, classifyId, 0, 500).then(articles => {
                userCache.setUserArticlesList(userId, classifyId, articles, "completed").then(res => {
                    logger.trace('User article list for user id: ' + userId + ' successfully wrote to cache with count: ' + articles.length);
                }).catch(err => {
                    logger.error('Set article list cache for user id: ' + userId + ' FAILED: ' + err);
                });

                return common.getRangeOfArray(articles, startIndex, startIndex + pageSize - 1);
            });
        }
    }).catch(err => {
        // There is an error while accessing the cache, log it and search in DB
        logger.error('Failed to get article list from cache: ' + err);
        return self.getUserArticlesByPublishTime(userId, classifyId, startIndex, pageSize).then(articles => {
            return common.getRangeOfArray(articles, 0, pageSize - 1);
        });
    });
};

/**
 * According to "author" field in the summary, fill the corresponding user information to the nested object.
 * Returns: summaries with user information in "user" field.
 */
exports.writeUserInformation = function (summaries) {
    var promises = [];
    summaries.forEach(s => promises.push(userInformation.getById(s.author)), this);

    return Q.all(promises).then(results => {
        results.forEach((user, index) => summaries[index].user = user);
        return summaries;
    });
}

var getUserArticlesByPublishTimeRawQuery = `
SELECT DISTINCT s.id, s.createTime FROM suit s
INNER JOIN suit_classify sc ON s.id = sc.suitId
    WHERE author = ? AND auditStatus IN (1, 2, 4) AND (? = 0 OR sc.classifyId = ?)
ORDER BY createTime DESC
LIMIT ?, ?;
`;
/**
 * Find all articles the user published (including Pending and Rejected), order them by publish time.
 * This is used for Weixin page now.
 */
exports.getUserArticlesByPublishTime = function (userId, classifyId, startIndex, count) {
    classifyId = parseInt(classifyId);
    userId = parseInt(userId);

    return sequelize.query(getUserArticlesByPublishTimeRawQuery, {
        replacements: [userId, classifyId, classifyId, startIndex, count],
        type: sequelize.QueryTypes.SELECT
    }).then(results => {
        return results;
    });
};

/*
    This should be in UserPublish table.
    Since it hasn't implemented now, search the Article table instead.
*/
/*
var getUserArticlesRawQuery = `

SELECT DISTINCT s.id, s.createTime FROM suit s
INNER JOIN suit_classify sc ON s.id = sc.suitId
    WHERE author = ? AND auditStatus = ? AND (? = 0 OR sc.classifyId = ?)
ORDER BY createTime DESC
LIMIT ?, ?;
`;*/
var getUserArticlesRawQuery = `
SELECT a.id, a.author, result.time AS createTime FROM suit a
INNER JOIN
(
    SELECT * FROM (
        SELECT MAX(sa.auditTime) AS time, sa.suitId AS id FROM suit AS ia
            INNER JOIN suit_classify sc ON sc.suitId = ia.id
            INNER JOIN suit_audit sa ON sa.suitId = ia.id
        WHERE
            ia.author = ? AND auditStatus = ? AND (? = 0 OR sc.classifyId = ?)
        GROUP BY sa.suitId
        ORDER BY sa.auditTime DESC
    ) AS r
) AS result ON a.id = result.id
ORDER BY result.time DESC
LIMIT ?, ?
`;
exports.getUserArticlesFromDb = function (userId, classifyId, startIndex, count) {
    classifyId = parseInt(classifyId);
    userId = parseInt(userId);

    return sequelize.query(getUserArticlesRawQuery, {
        replacements: [userId, approvedArticleStatus, classifyId, classifyId, startIndex, count],
        type: sequelize.QueryTypes.SELECT
    }).then(results => {
        return results;
    });
};

/**
 * TODO: Fetches this in UserPublish table.
 */
var getUserArticleCountRawQuery = `
SELECT COUNT(id) AS c_article FROM suit WHERE author = ? AND auditStatus = ?;
`;
exports.getArticleCountFromDb = function (userId) {
    return sequelize.query(getUserArticleCountRawQuery, {
        replacements: [userId, approvedArticleStatus],
        type: sequelize.QueryTypes.SELECT
    }).then(results => {
        if (results == null || results.length == 0 || results[0].c_article == null || results[0].c_article == undefined)
            return 0;

        return results[0].c_article;
    });
};
