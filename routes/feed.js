var express = require('express');
var router = express.Router();
var meta = require('../config/metadata.json')['old_db'];
var userInformation = require('../business_logic/user_information');
var feedInformation = require('../business_logic/feed_information')
var Q = require('q');

/*
    Gets the latest articles (activities and live in the furture) that the user has been subscribed.
    Parameters: userId, pageNumber
    Response: an array of the latest articles (grouped by authors) of each author that latest published (max 3 articles for each author).
              The authors are sorted in descending order of the time which latest article was published. 
*/
router.get('/list/:userId/:pageNumber', function(req, res, next) {
    /*
        Steps:
            1. Finds out the users that has been subscribed.
            2. Sorts these users by the latest article published time in descending order.
            3. According to the pager information, finds out the latest 3 articles these users published and return.
            
        For steps 2 and 3, we will search it in the cache first (which stores in the Redis database and has an expiration time of 30 minutes).
            If not hits, process them in the MySQL database and save them in our cache.
    */
    var userId = req.params.userId;
    var pageNumber = req.params.pageNumber;

    userInformation.getById(userId, true).then(user => {
        if (user == null || user.status != meta['active-user-status-id']) {
            throw new Error('参数无效：操作的用户不存在或已被停用。');
        }

        
    })
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

        return feedInformation.getFeededUsersByUserId(userId);
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
