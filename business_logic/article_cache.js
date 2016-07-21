var redis = require('../redis-db');
var path = require('path');
var config = require(path.join(__dirname, '..', 'config', 'config.json'))['product-configuration'];
var expireTime = parseInt(config['articleCacheExpireTime']) * 60 * 60; 
var logger = require('log4js').getLogger('user-service');

var self = this;

var getArticleSummaryKey = function (articleId) {
    return 'article-summary:' + articleId;
}

exports.getArticleSummaryByArticleId = function (articleId) {
    var key = getArticleSummaryKey(articleId);

    return redis.getAsync(key).then(article => {

    });
}