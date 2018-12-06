const Websocket = require('ws')
const chai = require('chai')
const expect = chai.expect

const mock = {
	silence: false,
	server: null,
	drop: false,
	failJoin: false,
	otChannels: {},
	init (options, cb) {
		mock.server = new Websocket.Server({port: options.port, clientTracking: true}, cb)
		mock.server.on('connection', (socket, upgradeReq) => {
			socket.projectId = upgradeReq.url.split('/')[2]
			socket.on('message', mock.handleMessage.bind(this, socket))
		})
	},
	destroy () {
		mock.server.close()
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
	sendJoined (message) {
		mock.sendToAll(['joined', message])
	},
	handleMessage (socket, rawMessage) {
		if (mock.drop) return // fall silent
		const message = JSON.parse(rawMessage)
		const handlers = {
			auth: mock.handleAuth,
			ping: mock.handlePing,
			'generic:increment': mock.handleIncrement,
			'ot:delta': mock.handleOtDelta
		}
		if (handlers[message[0]]) {
			handlers[message[0]](socket, message)
		}
	},
	handleAuth (socket, message) {
		expect(message[1]).to.contain.all.keys('token')
		let response
		if (message[1].token !== 'hunter2') {
			response = ['error', 'WRONG TOKEN']
		} else if (mock.failJoin) {
			response = ['join', {error: 'YOU LOOSE'}]
		} else {
			response = ['joined', {
				project: socket.projectId,
				additionalData: {},
				channels: {
					'initalChannel': {
						last_revision: 7
					}
				}
			}]
		}
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
		const channel = message[2]
		let response
		if (message[3].delta[0].insert === 'trash') {
			response = ['error', message[1], 'trashy request']
		} else {
			let rev = (mock.otChannels[channel] || 0) + 1
			mock.otChannels[channel] = rev
			response = ['success', message[1], {rev}]
		}

		socket.send(JSON.stringify(response))
	}
}

module.exports = mock
