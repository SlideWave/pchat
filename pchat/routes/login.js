var express = require('express');
var router = express.Router();
var config = require('../config');
var mysql = require('mysql');
var md5 = require('md5');
var moment = require('moment');
var async = require('async');

var User = require('../user');
var OpenChat = require('../openchat');

var DEFAULT_REGISTRATION_URL = '/login/register';

router.get('/', function(req, res) {
    res.render('login', { title: 'Login', pageScript: "login.page.js",
                            registrationURL: config.registrationURL });
});

router.get('/out', function(req, res) {
    req.session.destroy(function(err) {
        res.redirect('/login');
    })
});

router.get('/tzdetect', function(req, res) {
    res.render('tzdetect', { title: 'Timezone Detection', pageScript: "tzdetect.page.js"});
});

router.post('/tzdetect', function(req, res) {
    var sess = req.session;

    sess.timezone = parseInt(req.body.timezone, "10");
    res.redirect('/');
});

router.get('/register', function(req, res) {
    if (config.registrationURL != DEFAULT_REGISTRATION_URL) {
        res.status(404).send('Page not found');
        return;
    }

    var sess = req.session;

    sess.timezone = parseInt(req.body.timezone, "10");

    var error = null;
    if (req.query.e == "taken") {
        error = "That username is already taken";
    }

    if (req.query.e == "fields") {
        error = "All fields are required";
    }

    res.render('register', {title: 'Register', error: error});
});

router.post('/register', function(req, res) {
    if (config.registrationURL != DEFAULT_REGISTRATION_URL) {
        res.status(404).send('Page not found');
        return;
    }

    var sess = req.session;

    if (String.isEmpty(req.body.username) ||
        String.isEmpty(req.body.email) ||
        String.isEmpty(req.body.password)) {

            res.redirect('/login/register?e=fields');
            return;
    }

    User.createUser(null, req.body.username, req.body.email, req.body.password,
        function (err, newUser) {
            if (err) {
                if (err.code == 'ER_DUP_ENTRY') {
                  //this username is already taken
                  res.redirect('/login/register?e=taken');
                } else {
                    console.error(err);
                    res.status(500).send('Could not complete request');
                }

                return;
            }

            res.redirect('/login');
        }
    );
});

router.post('/', function(req, res) {
    User.authenticate(req.body.username, req.body.password, function(err, result) {
        if (err) {
            connection.end();
            res.status(500).send('Could not complete request');
            return;
        }

        if (! result) {
            res.render('login', {   title: 'Login',
                                    error: 'Login failed, try again',
                                    registrationURL: config.registrationURL,
                                    pageScript: "login.page.js",
                                    });
            return;
        }

        var sess = req.session;
        sess.userId = result.UUID;
        sess.username = result.username;

        if (req.body.timezone) {
            sess.timezone = parseInt(req.body.timezone, "10");
            res.redirect('/');
        } else {
            sess.timezone = 0;
            res.redirect('/login/tzdetect');
        }
    });
});

module.exports = router;
