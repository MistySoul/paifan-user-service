var redis = require('../redis-db');
var models = require('../models');
var self = this;

/*
    Finds out the specific range of the articles that the user has published (sort by time in descending order).
    It will use the Redis database to do a quick search, if does not appear, it will call the article service to get it and save it in cache.
*/
exports.getArticlesSummaryByUserId = function (userId, pageNumber) {
    
}

exports.eraseConfidentialInformation = function (user) {
    if (!user) {
        return null;
    }
    
    return {
        id: user.id,
        userName: user.userName,
        nickName: user.nickName,
        avatar: user.avatar
    };
}

exports.getById = function (userId, noSimplify) {
    return models.User.findOne({
        where: {
            id: userId
        }
    }).then(user => {
        if (noSimplify)
            return user;
        else 
            return self.eraseConfidentialInformation(user);
    });
};