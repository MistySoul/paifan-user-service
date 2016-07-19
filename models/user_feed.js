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
                
            }
        },
        indexes: [
            {
                name: 'user_feed_user_id',
                fields: ['userId']
            }
        ]
    });

    UserFeed.sync().then(function () {
        logger.trace('DB: UserFeed sync complete.');
    });

    return UserFeed;
};