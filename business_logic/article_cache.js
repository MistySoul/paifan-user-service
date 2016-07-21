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
    Returns: null (if cache misses) or article summary, mark
*/
exports.getArticleSummaryByArticleId = function (articleId, mark) {
    var key = getArticleSummaryKey(articleId);

    return redis.getAsync(key).then(article => {
        return article;
    }).catch(err => {
        logger.err('Error while fetching article cache: '+ err);
        return null;
    });
}

exports.setArticleSummary = function (summary, articleId) {
    if (!articleId && summary)
        articleId = summary.id;

    var key = getArticleSummaryKey(articleId);

    return redis.setAsync(key, summary).then(result => {
        return result;
    }).catch(err => {
        logger.error('Error while putting article cache: ' + err);
        throw err;
    });
}