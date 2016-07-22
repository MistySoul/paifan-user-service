var express = require('express');
var router = express.Router();
var meta = require('../config/metadata.json')['old_db'];
var userInformation = require('../business_logic/user_information');
var feedInformation = require('../business_logic/feed_information')
var Q = require('q');

/*
    Gets the latest articles (activities and live in the furture) that the user has been subscribed.
    Parameters: userId, pageNumber
    Response: an array of the latest articles in descending order.
*/
router.get('/list/:userId/:pageNumber', function(req, res, next) {
    /*
        Steps:
            1. Do a quick look in our cache to see whether we have cached it already. if so, simply return.
            2. If no cache is present, finds out the articles in our db and store them to the cache.
                (Currently we have this in this service).
        
        Note if the user subscribe/unsubscribe someone, the cache is no longer valid and needs to be refreshed.
    */
    var userId = req.params.userId;
    var pageNumber = parseInt(req.params.pageNumber);

    userInformation.getById(userId, true).then(user => {
        if (user == null || user.status != meta['active-user-status-id']) {
            throw new Error('参数无效：操作的用户不存在或已被停用。');
        }
        return feedInformation.getFeedListByUserId(userId, pageNumber);
    }).then(cache => {
        // Gets the summary of these articles
        return feedInformation.getArticlesSummary(cache);
    }).then(list => {
        res.send(list);
    }).catch(err => {
        return next(err);
    });
});

/*
    Gets all the authors(users) that the user has subscribed.
    Parameters: userId
    Response: an array of user ids (sorted) that the user has subscribed.
              This could be used to do a quick check on client side to decide whether a user is subscribed or not. 
*/
router.get('/userslist/:userId', function(req, res, next) {
    var userId = req.params.userId;
    userInformation.getById(userId, true).then(user => {
        if (user == null || user.status != meta['active-user-status-id']) {
            throw new Error('参数无效：操作的用户不存在或已被停用。');
        }

        return feedInformation.getFeededUsersIdByUserId(userId);
    }).then(users => {
        if (users == null) {
            res.send([]);
        } else {
            res.send(users);
        }
    }).catch(err => {
        return next(err);
    });
});

/*
    Adds an author to the user's subscribing list.
*/
router.get('/subscribe/:userId/:subscribeUserId', function(req, res, next) {
    var userId = req.params.userId;
    var subscribeUserId = req.params.subscribeUserId;

    Q.all(
        [userInformation.getById(userId, true),
        userInformation.getById(subscribeUserId, true)]
    ).then(results => {
        if (!results || results.length < 2 || results[0] == null || results[1] == null) {
            throw new Error('参数无效：操作的用户或待订阅的用户不存在。');
        }

        if (results[0].status != meta['active-user-status-id'] ||
            results[1].status != meta['active-user-status-id']) {
                throw new Error('无效的操作：操作的用户或待订阅的用户尚未启用或已被停用。');
        }
        return feedInformation.subscribeUser(userId, subscribeUserId);
    }).then(created => {
        return res.send({
            created: created
        });
    }).catch(err => {
        return next(err);
    });
});

/*
    Removes an author from the user's subscribing list.
*/
router.get('/unsubscribe/:userId/:subscribeUserId', function(req, res, next) {
    var userId = req.params.userId;
    var subscribeUserId = req.params.subscribeUserId;

    Q.all(
        [userInformation.getById(userId, true),
        userInformation.getById(subscribeUserId, true)]
    ).then(results => {
        if (!results || results.length < 2 || results[0] == null || results[1] == null) {
            throw new Error('参数无效：操作的用户或待订阅的用户不存在。');
        }

        if (results[0].status != meta['active-user-status-id']) {
                throw new Error('无效的操作：操作的用户尚未启用或已被停用。');
        }
        return feedInformation.unsubscribeUser(userId, subscribeUserId);
    }).then(count => {
        return res.send({
            deleted: count > 0
        });
    }).catch(err => {
        return next(err);
    });
});

module.exports = router;
