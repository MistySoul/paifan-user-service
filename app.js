var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var log4js = require('log4js');
var log4jslogger = log4js.getLogger('user-service');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var current_env = process.env.NODE_ENV || "development";
var config = require('./config/config.json');

var routes = require('./routes/index');
var user = require('./routes/user');
var feed = require('./routes/feed');

var sequelize = require('sequelize');

var app = express();

if (app.get('env') === 'development') {
  log4js.configure({
    appenders: [
      { type: 'console' },
      { type: 'file', filename: 'user-service.log', category: 'user-service' }
    ]
  });
} else {
  log4js.configure({
    appenders: [
      { type: 'file', filename: 'user-service.log', category: 'user-service' }
    ]
  });
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/user', user);
app.use('/feed', feed);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    //log4jslogger.error(req);
    log4jslogger.error(err);

    res.status(err.status || 500);
    
    res.send({
        type: "Error",
        message: err.message,
        statusCode: err.status || 500
      });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  //log4jslogger.error(req);
  log4jslogger.error(err);

  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
