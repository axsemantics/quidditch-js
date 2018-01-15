const Websocket = require('ws')
const chai = require('chai')
const expect = chai.expect

const mock = {
	silence: false,
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
		mock.sendToAll(payload)
	},
	broadcastRandomAck () {
		const payload = ['ot:ack', 'test:nope', {
			rev: 7
		}]
		mock.sendToAll(payload)
	},
	sendTrashSuccess () {
		const payload = ['success', '9999999', {}]
		mock.sendToAll(payload)
	},
	sendTrashError () {
		const payload = ['error', '9999999', 'ALARM']
		mock.sendToAll(payload)
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
		if (handlers[message[0]]) {
			handlers[message[0]](socket, message)
		}
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
		if (mock.silence) return
		const response = ['pong', message[1]]
		if (socket.readyState !== 1) // socket still open?
			return
		socket.send(JSON.stringify(response))
	},
	handleJoin (socket, message) {
		expect(message[1]).to.contain.all.keys('project')
		const response = ['joined', {
			project: message[1].project,
			additionalData: {},
			channels: {
				'initalChannel': {
					last_revision: 7
				}
			}
		}]
		if (socket.readyState !== 1) // socket still open?
			return
		socket.send(JSON.stringify(response))
	},
	handleIncrement (socket, message) {
		expect(message[2]).to.contain.all.keys('number')
		let response
		if (message[2].number === null) {
			response = ['error', message[1], 'NOT A NUMBER!']
		} else {
			response = ['success', message[1], {
				number: ++message[2].number
			}]
		}
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
