'use strict';

var logger = require('log4js').getLogger('user-service');

module.exports = function (sequelize, DataTypes) {
    var User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        userName: DataTypes.STRING,
        password: DataTypes.STRING,
        email: DataTypes.STRING,
        tel: DataTypes.STRING,
        nickName: DataTypes.STRING,
        avatar: DataTypes.STRING,
        userType: DataTypes.INTEGER,
        status: DataTypes.INTEGER,
        createTime: DataTypes.DATE,
        lastLoginTime: DataTypes.DATE
    }, {
        freezeTableName: true,
        tableName: 's_user',
        timestamps: false,
        classMethods: {
            associate: function (models) {
                
            }
        }
    });

    User.sync().then(function () {
        logger.trace('DB: User sync complete.');
    });

    return User;
};