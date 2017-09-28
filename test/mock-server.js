const Websocket = require('ws')
const chai = require('chai')
const expect = chai.expect

const mock = {
	server: null,
	drop: false,
	otChannels: {},
	init (options, cb) {
		mock.server = new Websocket.Server({port: options.port, clientTracking: true}, cb)
		mock.server.on('connection', (socket) => {
			socket.on('message', mock.handleMessage.bind(this, socket))
		})
	},
	killAll () {
		for (let client of mock.server.clients) {
			client.close()
		}
	},
	sendToAll (payload) {
		for (let client of mock.server.clients) {
			client.send(JSON.stringify(payload))
		}
	},
	broadcastDelta (channel, delta) {
		const payload = ['ot:delta', channel, {
			delta: delta.ops,
			rev: 7
		}]
		for (let client of mock.server.clients) {
			client.send(JSON.stringify(payload))
		}
	},
	handleMessage (socket, rawMessage) {
		if (mock.drop) return // fall silent
		const message = JSON.parse(rawMessage)
		const handlers = {
			auth: mock.handleAuth,
			ping: mock.handlePing,
			join: mock.handleJoin,
			'generic:increment': mock.handleIncrement,
			'ot:delta': mock.handleOtDelta
		}
		handlers[message[0]](socket, message)
	},
	handleAuth (socket, message) {
		expect(message[1]).to.contain.all.keys('token')
		if (message[1].token !== 'hunter2') return // TODO fail somehow
		const response = ['authenticated']
		if (socket.readyState !== 1) // socket still open?
			return
		socket.send(JSON.stringify(response))
	},
	handlePing (socket, message) {
		const response = ['pong', message[1]]
		if (socket.readyState !== 1) // socket still open?
			return
		socket.send(JSON.stringify(response))
	},
	handleJoin (socket, message) {
		expect(message[1]).to.contain.all.keys('project')
		const response = ['joined', {
			project: message[1].project,
			additionalData: {}
		}]
		if (socket.readyState !== 1) // socket still open?
			return
		socket.send(JSON.stringify(response))
	},
	handleIncrement (socket, message) {
		expect(message[1]).to.contain.all.keys('number')
		const response = ['generic:incremented', {
			number: ++message[1].number
		}]
		socket.send(JSON.stringify(response))
	},
	handleTimeout (socket, message) {
		// just let it rot
	},
	handleOtDelta (socket, message) {
		const channel = message[1]
		// const data = message[2]
		let rev = (mock.otChannels[channel] || 0) + 1
		mock.otChannels[channel] = rev
		const response = ['ot:ack', channel, {rev}]
		socket.send(JSON.stringify(response))
	}
}

module.exports = mock
