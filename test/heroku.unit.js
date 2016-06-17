'use strict'

var io = require('socket.io-client')

var chai = require('chai')
var expect = chai.expect

var wsUrl = 'https://microminion-registrar.herokuapp.com/'
//var wsUrl = 'http://localhost:5000'

describe('testing access to running registrar server', function () {
  var socket, socket2

  beforeEach(function (done) {
    // Setup
    socket = io.connect(wsUrl, {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true
    })
    socket.on('connect', function () {
      console.log('connected...')
      done()
    })
    socket.on('disconnect', function () {
      console.log('disconnected...')
    })
  })

  afterEach(function (done) {
    // Cleanup
    if (socket.connected) {
      console.log('disconnecting...')
      socket.disconnect()
    } else {
      // There will not be a connection unless you have done() in beforeEach, socket.on("connect"...)
      console.log('no connection to break...')
    }
    done()
  })

  it('should succesfully register user foo', function (done) {
    var registration = {}
    registration.username = 'foo'
    socket.emit('registration', registration, function (response, message) {
      expect(response).to.equal('200')
      done()
    })
  })

  it('should succesfully deregister user bar', function (done) {
    var registration = {}
    registration.username = 'bar'
    socket.emit('registration', registration, function (registration_response, message) {
      expect(registration_response).to.equal('200')
      var deregistration = {}
      deregistration.username = 'bar'
      socket.emit('deregistration', deregistration, function (deregistration_response, message) {
        expect(deregistration_response).to.equal('200')
        done()
      })
    })
  })

  it('should succesfully route messages from user foo to user bar', function (done) {
    socket2 = io.connect(wsUrl, {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true
    })

    socket2.on('signaling', function (message, callback) {
      console.log('receiving message ' + JSON.stringify(message))
      callback('200')
    })

    var reg_foo = {}
    reg_foo.username = 'foo'
    socket.emit('registration', reg_foo, function (registration_response, message) {
      expect(registration_response).to.equal('200')
      var reg_bar = {}
      reg_bar.username = 'bar'
      socket2.emit('registration', reg_bar, function (deregistration_response, message) {
        expect(deregistration_response).to.equal('200')
        var msg = {}
        msg.content = 'test'
        msg.from = 'foo'
        msg.to = 'bar'
        socket.emit('signaling', msg, function (signaling_response, message) {
          expect(signaling_response).to.equal('200')
          done()
        })
      })
    })
  })
})
