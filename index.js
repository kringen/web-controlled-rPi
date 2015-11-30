var express = require('express');
var path = require('path');
var socketio = require('socket.io');
var app = express();


var socketServer;
var serialPort;
var sendData = "";
var userArray = [];
var timerCounter = 60;
var currentDriver;
var debug = true;
var maxConcurrent = 0;
var serverStartDate = new Date();

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/pages/index.html'));
});

app.use("/libraries", express.static(__dirname + '/pages/libraries'));

var httpServer = app.listen(51865, function () {
    var host = httpServer.address().address;
    var port = httpServer.address().port;

    console.log('Web controlled Raspberry Pi listening at http://%s:%s', host, port);
});

try {
    initSocketIO(httpServer, debug);
}
catch (e) {
    console.log("Could not create socket server");
    console.log(e);
}

function initSocketIO(httpServer, debug) {
    socketServer = socketio.listen(httpServer);
    if (debug == false) {
        socketServer.set('log level', 1); // socket IO debug off
    }
    // On User Connection
    socketServer.on('connection', function (socket) {
        socket.emit('updateQueue', { userList: userArray });
        updateConcurrentUsers();
        console.log("user connected");
        
        //socket.emit('onconnection', {pollOneValue:sendData});

        socket.on('disconnect', function () {

            // Find the name of the user that just left the room
            //var user = userArray.filter(function(e){return e.id == socket.id})
            //socketServer.emit('updateQueueStatus', user.name + " has left the room.");

            // Remove connection from array where socket.id = user.id
            userArray = userArray.filter(function (e) { return e.id !== socket.id });
            socketServer.emit('updateQueue', { userList: userArray });
        });

        socket.on('addUser', function (data) {
            var user = { name: data, id: socket.id };
            userArray.push(user);
            console.log("Adding user: " + user.id);
            //emit to everyone
            socketServer.emit('updateQueueStatus', user.name + " has entered the room.");
            socketServer.emit('updateQueue', { userList: userArray });
            updateDriverStatus();
            updateConcurrentUsers();
        });

        socket.on('moveJoint', function (data) {
            if (socket.id == currentDriver) {
                var joint = data.joint;
                var degrees = data.deg;
                console.log("Moving " + joint);
                socketServer.emit('updateArmStatus', "Moving " + joint + " " + degrees);
            }
        });

    });
}

function switchDriver() {
    if (userArray.length > 0) {
        userArray.push(userArray.shift());
    }
}

function updateConcurrentUsers() {
    if (userArray.length > maxConcurrent) {
        maxConcurrent = userArray.length;
        //socketServer.emit("UpdateArmStatus", "There are " + userArray.length + " concurrent users.  This is a new record!");
    }
    socketServer.emit('updateMaxConcurrent', { startDate: serverStartDate, maxConcurrentUsers: maxConcurrent });
}

function updateDriverStatus() {
    var driver = userArray[0];
    currentDriver = driver.id;
    console.log("currentdriver:  " + currentDriver);
    socketServer.emit('updateQueue', { userList: userArray });
    socketServer.emit('currentDriver', driver); // Lead member in array is driving;
    socketServer.emit('updateDriverStatus', driver.name + " is now driving.");
}

// Begin timer
setInterval(function () {
    if (userArray.length > 0) {
        if (timerCounter == 0) {
            timerCounter = 90;
            switchDriver();
            updateDriverStatus();
        }
        timerCounter--;
        socketServer.emit('updateTimer', timerCounter);
    }
}, 1000);