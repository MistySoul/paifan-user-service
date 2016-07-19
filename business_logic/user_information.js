var models = require('../models');
var self = this;

exports.eraseConfidentialInformation = function (user) {
    return {
        id: user.id,
        userName: user.userName,
        nickName: user.nickName,
        avatar: user.avatar
    };
}

exports.getById = function (userId) {
    return models.User.findOne({
        where: {
            id: userId
        }
    }).then(user => {
        return self.eraseConfidentialInformation(user);
    });
};