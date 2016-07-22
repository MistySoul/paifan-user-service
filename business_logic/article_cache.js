var redis = require('../redis-db');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var expireTime = parseInt(config['articleCacheExpireTime']) * 60 * 60; 
var logger = require('log4js').getLogger('user-service');

var self = this;

var getArticleSummaryKey = function (articleId) {
    return 'article-summary:' + articleId;
}

/*
    Gets the summary of the article in cache.
    Parameters: articleId, mark (any object that will be returned directly which the caller could be identify the article)
    Returns: An object {summary: null (if cache misses) or article summary, mark: mark } if mark == true, otherwise the summary object.
*/
exports.getArticleSummaryByArticleId = function (articleId, mark) {
    var key = getArticleSummaryKey(articleId);

    return redis.getAsync(key).then(article => {
        redis.expireAsync(key, expireTime).then(res => {
            //logger.trace('Set expire time: ' + res);
        }).catch(err => {
            logger.trace('Set expire time failed for article cache: ' + err);
        });
        
        if (mark !== undefined) return { summary: article, mark: mark }; else return article;
    })  //.delay(Math.random() * 1000) // for test only!
    .catch(err => {
        logger.err('Error while fetching article cache: '+ err);
        if (mark !== undefined) return { summary: null, mark: mark }; else return null;
    });
}

exports.setArticleSummary = function (summary, articleId) {
    if (!articleId && summary)
        articleId = summary.id;

    var key = getArticleSummaryKey(articleId);

    return redis.setexAsync(key, expireTime, JSON.stringify(summary)).then(result => {
        return result;
    }).catch(err => {
        logger.error('Error while putting article cache: ' + err);
        throw err;
    });
}