var redis = require('../redis-db');
var models = require('../models');
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