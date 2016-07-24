var redis = require('../redis-db');
var models = require('../models');
var userCache = require('./user_cache');
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
        avatar: user.avatar
    };
}

exports.getById = function (userId, noSimplify) {
    return userCache.getUserInformation(userId).then(information => {
        if (information != null)  //presents in cache, simple return
            return information;

        return self.getByIdFromDb(userId).then(information => {
            userCache.setUserInformation(userId, information).then(count => {
                logger.trace('Write ' + count + ' object to user information cache.');
            }).catch(err => {
                logger.error('Failed to write user information to cache: ' + err);
            });

            return information;
        });
    }).then(information => {
        if (!noSimplify)
            information = self.eraseConfidentialInformation(information);

        return information;
    });
}

exports.getByIdFromDb = function (userId) {
    return models.User.findOne({
        where: {
            id: userId
        }
    }).then(user => {
        return user;
    });
};