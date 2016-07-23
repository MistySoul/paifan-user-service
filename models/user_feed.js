'use strict';

var logger = require('log4js').getLogger('user-service');

module.exports = function (sequelize, DataTypes) {
    var UserFeed = sequelize.define('UserFeed', {
        userId: {
            type: DataTypes.INTEGER,
            references: 's_user',
            referencesKey: 'id'
        },
        feedUserId: {
            type: DataTypes.INTEGER,
            references: 's_user',
            referencesKey: 'id'
        }
    }, {
        freezeTableName: true,
        tableName: 'UserFeed',
        timestamps: false,
        classMethods: {
            associate: function (models) {
                UserFeed.belongsTo(models.User, {as: 'User', foreignKey: 'userId'});
                UserFeed.belongsTo(models.User, {as: 'SubscribeUser', foreignKey: 'feedUserId'});
            }
        },
        indexes: [
            {
                name: 'user_feed_user_id',
                fields: ['userId']
            }, 
            {
                name: 'user_feed_feed_user_id',
                fields: ['feedUserId']
            }
        ]
    });

    UserFeed.sync().then(function () {
        logger.trace('DB: UserFeed sync complete.');
    });

    return UserFeed;
};