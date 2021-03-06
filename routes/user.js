var express = require('express');
var router = express.Router();
var userInformation = require('../business_logic/user_information');
var articleInformation = require('../business_logic/article_information');
var meta = require('../config/metadata.json')['old_db'];

/* GET users listing. */
router.get('/', function(req, res, next) {
    res.send('respond with a resource');
});

router.get('/:id', function(req, res, next) {
    var uid = req.params.id;
    userInformation.getById(uid).then(user => {
        if (user == null) {
            return next(new Error('User id: ' + uid + ' does not exist.'));
        } else {
            res.send(user);
        }
    }).catch(err => {
        return next(err);
    });
});

router.get('/articles/completed/:userId/:pageNumber', function(req, res, next) {
    var uid = req.params.userId;
    var pageNumber = req.params.pageNumber;

    userInformation.getById(uid, false).then(user => {
        if (user == null) {
            throw new Error('参数无效：操作的用户不存在。');
        }
        return articleInformation.getCompletedUserArticlesByPublishTime(uid, 0, pageNumber).then(cache => {
            return articleInformation.getArticlesSummary(cache).then(summaries => {
                summaries.forEach((s, i) => { s.createTime = cache[i].createTime; } );
                return summaries;
            });
        }).then(list => {
            return res.send({
                user: user,
                articles: list
            });
        });
    }).catch(err => {
        return next(err);
    });
});

router.get('/articles/:userId/:pageNumber', function(req, res, next) {
    var uid = req.params.userId;
    var pageNumber = req.params.pageNumber;

    userInformation.getById(uid, false).then(user => {
        if (user == null) {
            throw new Error('参数无效：操作的用户不存在。');
        }
        return articleInformation.getUserArticles(uid, 0, pageNumber).then(cache => {
            return articleInformation.getArticlesSummary(cache).then(summaries => {
                summaries.forEach((s, i) => { s.createTime = cache[i].createTime; } );
                return summaries;
            });
        }).then(list => {
            return res.send({
                user: user,
                articles: list
            });
        });
    }).catch(err => {
        return next(err);
    });
});

router.get('/articles/:userId/:classifyId/:pageNumber', function (req, res, next) {
    var uid = req.params.userId;
    var pageNumber = req.params.pageNumber;
    var classifyId = req.params.classifyId;

    userInformation.getById(uid, false).then(user => {
        if (user == null) {
            throw new Error('参数无效：操作的用户不存在。');
        }
        return articleInformation.getUserArticles(uid, classifyId, pageNumber).then(cache => {
            return articleInformation.getArticlesSummary(cache).then(summaries => {
                summaries.forEach((s, i) => { s.createTime = cache[i].createTime; } );
                return summaries;
            });
        }).then(list => {
            return res.send({
                user: user,
                articles: list
            });
        });
    }).catch(err => {
        return next(err);
    });
});

router.get('/articles/completed/:userId/:classifyId/:pageNumber', function (req, res, next) {
    var uid = req.params.userId;
    var pageNumber = req.params.pageNumber;
    var classifyId = req.params.classifyId;

    userInformation.getById(uid, false).then(user => {
        if (user == null) {
            throw new Error('参数无效：操作的用户不存在。');
        }
        return articleInformation.getCompletedUserArticlesByPublishTime(uid, classifyId, pageNumber).then(cache => {
            return articleInformation.getArticlesSummary(cache).then(summaries => {
                summaries.forEach((s, i) => { s.createTime = cache[i].createTime; } );
                return summaries;
            });
        }).then(list => {
            return res.send({
                user: user,
                articles: list
            });
        });
    }).catch(err => {
        return next(err);
    });
});

router.post('/articles/publish', function(req, res, next) {

});

module.exports = router;
