'use strict';

var fs = require('fs');
var http = require('http');
var path = require('path');

var express = require('express');
var WSProtocol = require('ws-protocol');

var app = express();
app.use(function (req, res, next) {
    console.log('request:', req.url);
    return next();
});

app.use('/', express.static(path.join(__dirname, 'public')));

var server = http.createServer(app);

var protocol = new WSProtocol(server, {});

protocol.on('client', function (client) {
    protocol.broadcast({
        action: 'join',
        id: client.id
    });

    client.on('message', function (data) {
        console.log('got message from', client.id, data);
    });

    client.on('close', function () {
        console.log('connection closed');
        protocol.broadcast({
            action: 'leave',
            id: client.id
        });
    });
});

server.listen(3000);

console.log('Server started: http://localhost:3000/');
