var models = require('../models');
var self = this;

exports.getFeededUsersByUserId = function (userId) {
    return models.UserFeed.findAll({
        attributes: ['feedUserId'],
        where: {
            userId: userId
        },
        order: 'feedUserId'
    }).then(users => {
        var idArray = [];
        users.forEach(user => { idArray.push(user.feedUserId); }, this);
        return idArray;
    });
};

exports.subscribeUser = function (userId, subscribeUserId) {
    return models.UserFeed.findOrCreate({
        where: {
            userId: userId,
            feedUserId: subscribeUserId
        }
    }).spread((userFeed, created) => {
        return created;
    });
}

exports.unsubscribeUser = function (userId, subscribeUserId) {
    return models.UserFeed.destroy({
        where: {
            userId: userId,
            feedUserId: subscribeUserId
        }
    }).then(count => {
        return count;
    });
}