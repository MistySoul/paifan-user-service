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
            
    }).then(articleCacheArray => {
        var summaries = [];
        articleCacheArray.forEach(c => summaries.push(JSON.parse(c.summary)), this);

        return summaries;
    }).catch(err => {
        logger.error('Error while get article summaries: ' + err);
        throw err;
    });
};

/*
    Gets the latest articles (only ids) published by the user.
    
    Steps:
        1. Search the list in the user cache, if hits, simple return.
        2. If not in cache, search it in DB (max 500 articles) to get the ids and save it in cache.
*/
exports.getUserArticles = function (userId, pageNumber) {
    var startIndex = pageNumber * pageSize;
    
    return userCache.getUserArticlesByUserId(userId, startIndex, startIndex + pageSize - 1).then(articles => {
        if (articles != null)  // Cache hits, return it.
            return common.getRangeOfArray(articles, 0, articles.length - 1, true);
        else {
            //Search in DB and store it in cache. Hard code the count now...
            return self.getUserArticlesFromDb(userId, 0, 500).then(articles => {
                userCache.setUserArticlesList(userId, articles).then(res => {
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
        return self.getUserArticlesFromDb(userId, startIndex, pageSize).then(articles => {
            return common.getRangeOfArray(articles, 0, pageSize - 1);
        });
    });
}

/*
    This should be in UserPublish table.
    Since it hasn't implemented now, search the Article table instead.
*/
var getUserArticlesRawQuery = `
SELECT id, createTime FROM suit
    WHERE author = ? AND auditStatus = ?
ORDER BY createTime DESC
LIMIT ?, ?;
`;
exports.getUserArticlesFromDb = function (userId, startIndex, count) {
    return sequelize.query(getUserArticlesRawQuery, {
        replacements: [userId, approvedArticleStatus, startIndex, count],
        type: sequelize.QueryTypes.SELECT
    }).then(results => {
        return results;
    });
};

