'use strict'

var fs = require('fs')
var server = require('http').createServer(onHttpRequest)
var urls = require('url')
var winston = require('winston')
var winstonWrapper = require('winston-meta-wrapper')

var log = winstonWrapper(winston)
log.addMeta({
  module: 'microminion:1tp:registrar'
})
winston.level = 'debug'

var defaultPort = 5000
var defaultPingInterval = 25000
var defaultPingTimeout = 600000
var defaultHeartbeatInterval = 60000

var listeningPort = process.env.LISTENING_PORT || defaultPort
var pingInterval = process.env.PING_INTERVAL || defaultPingInterval
var pingTimeout = process.env.PING_TIMEOUT || defaultPingTimeout
var heartbeatInterval = process.env.HEARTBEAT_INTERVAL || defaultHeartbeatInterval

var io = require('socket.io')(server, {
  pingInterval: pingInterval,
  pingTimeout: pingTimeout
})
var sockets = {}

server.listen(listeningPort)
log.info('signaling server accepts socket.io requests on port ' + listeningPort)

// heartbeats
if (heartbeatInterval) {
  setTimeout(sendHeartbeat, heartbeatInterval)
}

function sendHeartbeat () {
  setTimeout(sendHeartbeat, heartbeatInterval)
  log.debug('sending ping to all clients')
  io.emit('ping', { beat: 1 })
}

// http requests
function onHttpRequest (request, response) {
  var uri = urls.parse(request.url).pathname
  // GET /users
  if (uri === '/users') {
    var users = []
    for (var user in sockets) {
      users.push(user)
    }
    response.writeHead(200)
    response.end(JSON.stringify(users))
  // GET /users/:uid
  } else if (uri.indexOf('/users') > -1) {
    var tergetUser = uri.replace('/users/', '')
    if (sockets[tergetUser]) {
      response.writeHead(200)
      response.end('User can be reached.')
    } else {
      response.writeHead(404)
      response.end('User ' + tergetUser + ' cannot be found.')
    }
  // all dazed and confused
  } else {
    response.writeHead(404)
    response.end('Cannot process ' + uri)
  }
}

// websocket events
io.on('connection', function (socket) {
  socket.on('registration', function (message, callback) {
    registerSocket(
      message.username,
      socket,
      callback, // on success
      callback // on error
    )
  })

  socket.on('deregistration', function (message, callback) {
    deregisterSocket(
      message.username,
      callback, // on success
      callback // on error
    )
  })

  socket.on('signaling', function (message, callback) {
    forwardMessage(
      message.to,
      message,
      callback, // on success
      callback // on error
    )
  })

  socket.on('pong', function (data) {
    log.debug('pong received from client ' + socket.owner)
  })

  socket.on('disconnect', function (reason) {
    var username = socket.owner
    log.debug('socket for user ' + username + ' has closed: reason = ' + reason)
    if (username) {
      removeClosedSocket(username)
    }
  })

  socket.on('error', function (e) {
    log.error('Socket error for peer ' + socket.remoteAddress + ': ' + e)
  })
})

/* register client socket in response to REGISTRATION event */
function registerSocket (username, socket, onSuccess, onError) {
  // duplicate registrations are not permitted
  // if (sockets[username]) {
  // 	log.error('Duplicate sockets for ' + username
  // 			+ ', socket will not be registered')
  // 	onError('duplicate_registration')
  // 	return
  // }

  sockets[username] = socket
  socket.owner = username
  log.debug('socket for ' + username + ' has been registered locally.')
  log.debug(Object.keys(sockets).length + ' clients connected.')
  onSuccess('200')
}

/* deregister client socket in response to DEREGISTRATION event --
   note that this event may be sent over a different socket */
function deregisterSocket (username, onSuccess, onError) {
  // check if username is known
  if (!sockets[username]) {
    log.debug('socket for ' + username + ' does not exist')
    onSuccess('200')
    return
  }
  // fetch associated socket, and delete reference
  var socket = sockets[username]
  socket.owner = undefined
  delete sockets[username]
  log.debug('Socket for ' + username + ' has been removed locally.')
  log.debug(Object.keys(sockets).length + ' sockets left.')
  // respond to client
  onSuccess('200')
}

/* forward message to target */
function forwardMessage (target, message, onSuccess, onError) {
  log.debug('Forwarding message ' + message.type + ' to target ' + target)
  var socket = sockets[target]
  if (socket) {
    log.debug('found websocket socket for target ' + target + ', forwarding message to client.')
    socket.emit('signaling', message, function (response) {
      log.debug('message ' + message.type + ' delivered to target ' + target + ', returning response ' + response + ' to ' + message.from)
      onSuccess(response)
    })
  } else {
    log.debug('could not find target ' + target +
      ', it seems it has not been registered here.')
    onError('404')
  }
}

/* remove client socket when socket was closed */
function removeClosedSocket (username) {
  // check if username is known
  if (!sockets[username]) {
    log.error('socket for ' + username + ' does not exist')
    return
  }
  // delete user socket
  delete sockets[username]
  log.debug('Socket for ' + username + ' has been removed locally.')
  log.debug(Object.keys(sockets).length + ' sockets left.')
}
