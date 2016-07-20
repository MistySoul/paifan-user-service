var express = require('express');
var router = express.Router();
var userInformation = require('../business_logic/user_information');

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

module.exports = router;
