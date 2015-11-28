var fs = require('fs')
,http = require('http'),
socketio = require('socket.io'),
express = require('express');
url = require("url")//, 
//SerialPort = require("serialport").SerialPort

var app = express();
// GET method route
app.get('/', function (req, res) {
    res.send('GET request to the homepage');
});



var socketServer;
var serialPort;
//var portName = '/dev/ttyUSB0'; //change this to your Arduino port
var sendData = "";
var userArray = [];
var timerCounter = 60;
var currentDriver;

// Begin timer
setInterval(function() {
	if(userArray.length > 0)
	{
	if(timerCounter == 0)
		{
		timerCounter = 90;
		switchDriver();
		updateDriverStatus();	
		}
	timerCounter--;	
	socketServer.emit('updateTimer',timerCounter);
	}
}, 1000);

// handle contains locations to browse to (vote and poll); pathnames.
function startServer(route,handle,debug)
{
	// on request event
	function onRequest(request, response) {
	  // parse the requested url into pathname. pathname will be compared
	  // in route.js to handle (var content), if it matches the a page will 
	  // come up. Otherwise a 404 will be given. 
	  var pathname = url.parse(request.url).pathname; 
	  console.log("Request for " + pathname + " received");
	  var content = route(handle,pathname,response,request,debug);
	}
	
	var httpServer = http.createServer(onRequest).listen(51865, function(){
		console.log("Listening at: http://localhost:51865");
		console.log("Server is up");
	}); 
	
    /*
	try {
	serialListener(debug);
	}
	catch(e) {
	console.log("Could not connect to " + portName);
	console.log(e);
	}*/
	
	try {
		initSocketIO(httpServer,debug);
	}
	catch(e) {
	console.log("Could not create socket server");
	console.log(e);
	}
	
}

function initSocketIO(httpServer,debug)
{
	socketServer = socketio.listen(httpServer);
	if(debug == false){
		socketServer.set('log level', 1); // socket IO debug off
	}
	// On User Connection
	socketServer.on('connection', function (socket) {
	socket.emit('updateQueue',{userList:userArray});
	console.log("user connected");
	//socket.emit('onconnection', {pollOneValue:sendData});
	
	socket.on('disconnect', function () {
	
	// Find the name of the user that just left the room
	//var user = userArray.filter(function(e){return e.id == socket.id})
	//socketServer.emit('updateQueueStatus', user.name + " has left the room.");
	
	// Remove connection from array where socket.id = user.id
	userArray = userArray.filter(function(e){return e.id !== socket.id});
	socketServer.emit('updateQueue',{userList:userArray});
	});
	
	socket.on('addUser', function(data) {
	var user = {name:data, id:socket.id};
	userArray.push(user);
	console.log("Adding user: " + user.id);
	//emit to everyone
	socketServer.emit('updateQueueStatus', user.name + " has entered the room.");
	socketServer.emit('updateQueue',{userList:userArray});
	updateDriverStatus();
	});
	
	socket.on('moveJoint', function(data) {
		if(socket.id == currentDriver)
			{
			var joint = data.joint;
			var degrees = data.deg;
			socketServer.emit('updateArmStatus', "Moving " + joint + " " + degrees);
			}
		});
	
    });
}

function switchDriver()
	{
	if(userArray.length > 0)
		{
		userArray.push(userArray.shift());	
		}
	}

function updateDriverStatus()	
	{
		var driver = userArray[0];
		currentDriver = driver.id;
		console.log("currentdriver:  " + currentDriver);
		socketServer.emit('updateQueue',{userList:userArray});
		socketServer.emit('currentDriver',driver); // Lead member in array is driving;
		socketServer.emit('updateDriverStatus', driver.name + " is now driving.");
	}

/*
// Listen to serial port
function serialListener(debug)
{
    var receivedData = "";
    serialPort = new SerialPort(portName, {
        baudrate: 9600,
        // defaults for Arduino serial communication
         dataBits: 8,
         parity: 'none',
         stopBits: 1,
         flowControl: false
    });
 
    serialPort.on("open", function () {
      console.log('serial port connected');
            // Listens to incoming data
        serialPort.on('data', function(data) {
             receivedData += data.toString();
          if (receivedData .indexOf('E') >= 0 && receivedData .indexOf('B') >= 0) {
           sendData = receivedData .substring(receivedData .indexOf('B') + 1, receivedData .indexOf('E'));
           receivedData = '';
         }
         // send the incoming data to browser with websockets.
       socketServer.emit('update', sendData);
      });  
    });  
}
*/
exports.start = startServer;
