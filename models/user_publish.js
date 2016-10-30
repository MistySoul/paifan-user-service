/*
    (Currently we don't use this, all datas are fetched from the Article table. Will have to implement this in the next version which supports Activities and Lives.)
    UserPublish table stores the article/activity/live ids and time that a user has been published.
    It might seems to be duplicated with the Article/Activity/Live tables (which already contains all information),
        but it will be nice if we are seperate our DB (split the service and storage of Articles and Users) in the furture,
        and it makes easier to find out all types.
    
    Note: we'll have to initialize this table with the data in the Articles table.
*/

'use strict';

var logger = require('log4js').getLogger('user-service');

module.exports = function (sequelize, DataTypes) {
    var UserPublish = sequelize.define('UserPublish', {
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: 's_user',
                referencesKey: 'id'
            }
        },
        publisherType: DataTypes.INTEGER,
        publisherId: DataTypes.INTEGER,
        createTime: DataTypes.DATE,
        approvedTime: DataTypes.DATE
    }, {
        freezeTableName: true,
        tableName: 'user_publish',
        timestamps: false,
        classMethods: {
            associate: function (models) {
                
            }
        },
        indexes: [
            {
                name: 'user_publish_user_id',
                fields: ['userId', 'approvedTime']
            }
        ]
    });

    UserPublish.sync().then(function () {
        logger.trace('DB: UserPublish sync complete.');
    });

    return UserPublish;
};