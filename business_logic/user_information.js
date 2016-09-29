var redis = require('../redis-db');
var models = require('../models');
var userCache = require('./user_cache');
var feedInformation = require('./feed_information');
var articleInformation = require('./article_information');
var logger = require('log4js').getLogger('user-service');
var self = this;

exports.eraseConfidentialInformation = function (user) {
    if (!user) {
        return null;
    }
    
    return {
        id: user.id,
        userName: user.userName,
        nickName: user.nickName,
        avatar: user.avatar,
        articleCount: user.articleCount
    };
}

exports.getById = function (userId, noSimplify) {
    return userCache.getUserInformation(userId).then(information => {
        if (information != null)  //presents in cache, simple return
            return information;

        return self.getByIdFromDb(userId).then(information => {

            // Now that we don't handle article published information,
            //    we will refresh the article count until the cache expires.
            // In the future we will have to move away this to handle the article count in a seperate way.
            return articleInformation.getArticleCountFromDb(userId).then(count => {
                if (information.dataValues) {
                    // The cache will retrieve the dataValues property, so added it as well.
                    information.dataValues.articleCount = count;
                }

                information.articleCount = count;

                userCache.setUserInformation(userId, information).then(count => {
                    logger.trace('Write ' + count + ' object to user information cache.');
                }).catch(err => {
                    logger.error('Failed to write user information to cache: ' + err);
                });

                return information;
            });
        });
    }).then(information => {
        if (!noSimplify)
            information = self.eraseConfidentialInformation(information);

        return information;
    }).then(information => {
        // Gets the subscribers count of this user.
        return userCache.getUserSubscribersCount(userId).then(count => {
            if (count != null) {
                if (count < 0) count = 0;
                information.subscribersCount = count;
                return information;
            } else {
                // Cache miss, fetch it from DB.
                return feedInformation.getSubscribingUsersCountFromDb(userId).then(count => {
                    information.subscribersCount = count;
                    
                    userCache.setUserSubscriberCount(userId, count).then(count => {
                        logger.trace('Fetched subscribers count from DB and wrote to cache for user ' + userId);
                    }).catch(err => {
                        logger.error('Failed to set subscribers count for user: ' + err);
                    });

                    return information;
                });
            }
        });
    });
};

exports.getByIdFromDb = function (userId) {
    return models.User.findOne({
        where: {
            id: userId
        }
    }).then(user => {
        return user;
    });
};