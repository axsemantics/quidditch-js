/* global describe, before, after, it */

const chai = require('chai')
const expect = chai.expect
chai.use(require('./delta-string-utils'))

const server = require('./mock-server')
const { QuidditchClient, Delta } = require('../dist/quidditch.js')

const PORT = 9436
const WS_URL = 'ws://localhost:9436/projects/my-project'
// const WS_URL = 'wss://api-stage.ax-semantics.com/ws/rohrpost/'
let client = null
describe('Quidditch Client', () => {
	before(function (done) {
		server.init({
			port: PORT
		}, done)
	})

	after(function () {
		server.destroy()
	})

	it('should detect auth timeouts and reconnect', (done) => {
		server.silence = true
		client = new QuidditchClient(WS_URL, {pingInterval: 300, token: 'hunter2'})
		client.once('closed', () => {
			server.silence = false
			client.once('joined', () => {
				client.close()
				done()
			})
		})
		client.once('ping', () => done('should not ping'))
	})

	it('should detect join timeouts and reconnect', (done) => {
		server.joinSilence = true
		client = new QuidditchClient(WS_URL, {pingInterval: 50, joinTimeout: 300, token: 'hunter2'})
		client.once('closed', () => {
			server.joinSilence = false
			client.once('joined', () => {
				client.close()
				done()
			})
		})
		client.once('ping', () => done('should not ping'))
	})

	it('should set default call timeout', (done) => {
		client = new QuidditchClient(WS_URL, {callTimeout: 100, token: 'hunter2'})
		client.once('joined', () => {
			client.call('generic:invalid', {number: null}).then(() => {
				done('should not succeed')
			}).catch((error) => {
				expect(error.message).to.equal('call timed out')
				client.close()
				done()
			})
		})
	}).timeout(1500)

	it('should connect, and fail on wrong authentication', (done) => {
		client = new QuidditchClient(WS_URL, {token: 'hunter3'})
		client.on('error', () => {
			client.close()
			done()
		})
		client.once('joined', (data) => {
			done('should not join')
		})
	})

	it('should connect, and fail on join', (done) => {
		server.failJoin = true
		client = new QuidditchClient(WS_URL, {token: 'hunter2'})
		client.on('error', () => {
			server.failJoin = false
			client.close()
			done()
		})
		client.once('joined', (data) => {
			server.failJoin = false
			done('should not join')
		})
	})

	it('should connect, authenticate & join automatically', (done) => {
		client = new QuidditchClient(WS_URL, {pingInterval: 300, reconnectDelay: 300, token: 'hunter2'})
		client.on('error', (error) => {
			throw new Error(error) // let us hear the screams
		})
		client.once('joined', (data) => {
			expect(data).to.contain.all.keys('project', 'additionalData', 'channels')
			expect(data.project).to.equal('my-project')
			expect(client._otChannels['initalChannel'].rev).to.equal(7)
			done()
		})
	})

	it('should ping', (done) => {
		server.pings = 0
		let counter = 0
		const count = () => {
			client.once('pong', () => {
				counter++
				expect(counter).to.equal(server.pings)
				if (counter >= 3) done()
				else count()
			})
		}
		count()
	}).timeout(1500)

	it('should receive generic broadcast', (done) => {
		client.once('message', (message) => {
			expect(message[0]).to.equal('broadcast')
			expect(message[1]).to.equal('broadcast payload')
			done()
		})
		server.sendToAll(['broadcast', 'broadcast payload'])
	})

	it('should handle a generic call', (done) => {
		client.call('generic:increment', {number: 3}).then((response) => {
			expect(response).to.contain.all.keys('number')
			expect(response.number).to.equal(4)
			done()
		})
	})

	it('should handle a generic call with error', (done) => {
		client.call('generic:increment', {number: null}).then(() => {
			done('should not succeed')
		}).catch((error) => {
			expect(error.message).to.equal('NOT A NUMBER!')
			expect(error.apiError.message).to.equal('NOT A NUMBER!')
			done()
		})
	})

	it('should detect timouted generic calls', (done) => {
		client.call('generic:invalid', {number: null}, {timeout: 200}).then(() => {
			done('should not succeed')
		}).catch((error) => {
			expect(error.message).to.equal('call timed out')
			done()
		})
	})

	it('should not forward errors after call timed out', (done) => {
		client.call('generic:delayed-error', {number: null}, {timeout: 200}).then(() => {
			done('should not succeed')
		}).catch((error) => {
			expect(error.message).to.equal('call timed out')
			// error throwing is detected by the client fixture
			setTimeout(done, 200)
		})
	})

	it('should send a delta and handle the ack', (done) => {
		const channel = 'test:1234'
		client.sendDelta(channel, new Delta([{insert: 'Hello World'}])).then(() => done())
	})

	it('should handle broken delta with error', (done) => {
		const channel = 'test:trash'
		client.sendDelta(channel, new Delta([{insert: 'trash'}])).then(() => {
			done('should not succeed')
		}).catch((error) => {
			expect(error.message).to.equal('trashy request')
			done()
		})
	})

	it('should send a delta and buffer', (done) => {
		const channel = 'test:1234'
		Promise.all([
			client.sendDelta(channel, new Delta([{insert: 'Hello World'}])),
			client.sendDelta(channel, new Delta([{insert: 'Hello World'}]))
		]).then(() => {
			done()
		})
	})

	it('should receive a delta and apply', (done) => {
		const channel = 'test:1234'
		const delta = new Delta([{insert: 'Hello World'}])
		server.broadcastDelta(channel, delta)
		client.once('ot:delta', (returnChannel, returnDelta) => {
			expect(returnChannel).to.equal(channel)
			expect(returnDelta).to.equalDelta(delta)
			done()
		})
	})

	it('should receive a delta on a new channel', (done) => {
		const channel = 'test:extern'
		const delta = new Delta([{insert: 'Hello World'}])
		server.broadcastDelta(channel, delta)
		client.once('ot:delta', (returnChannel, returnDelta) => {
			expect(returnChannel).to.equal(channel)
			expect(returnDelta).to.equalDelta(delta)
			done()
		})
	})

	it('should receive a delta and transform', (done) => {
		const channel = 'test:12345'
		const deltaInFlight = new Delta([{insert: 'Hello World'}])
		const sendingDelta = new Delta([{insert: 'I AM FIRST'}])
		server.broadcastDelta(channel, sendingDelta)
		const sendFullfilled = client.sendDelta(channel, deltaInFlight)
		client.once('ot:delta', (returnChannel, returnDelta) => {
			expect(returnChannel).to.equal(channel)
			expect(returnDelta).to.equalDelta(deltaInFlight.transform(sendingDelta))
			sendFullfilled.then(() => done())
		})
	})

	it('should buffer multiple deltas', (done) => {
		const channel = 'test:123456'
		const deltaInFlight = new Delta([{insert: 'Hello World'}])
		const moreDelta = new Delta([{retain: 11}, {insert: ', how'}])
		const evenMoreDelta = new Delta([{retain: 16}, {insert: ' are you?'}])
		const bufferDelta = deltaInFlight.compose(evenMoreDelta).compose(moreDelta)
		const sendingDelta = new Delta([{insert: 'I AM FIRST'}])
		server.broadcastDelta(channel, sendingDelta)
		const sendFullfilled = Promise.all([
			client.sendDelta(channel, deltaInFlight),
			client.sendDelta(channel, moreDelta),
			client.sendDelta(channel, evenMoreDelta)
		])
		client.once('ot:delta', (returnChannel, returnDelta) => {
			expect(returnChannel).to.equal(channel)
			expect(returnDelta).to.equalDelta(bufferDelta.transform(sendingDelta))
			sendFullfilled.then(() => done())
		})
	})

	it('should correctly resolve conflicts: Client 1', (done) => {
		const channel = 'test-conflict'
		const delta1 = new Delta([{insert: 'a'}])
		const delta2 = new Delta([{retain: 1}, {insert: 'b'}])
		const _originalHandler = server.handleOtDelta
		server.handleOtDelta = function (socket, message) {
			const {delta, rev} = message[3]
			if (delta[0].insert === 'a' && rev === 0) {
				socket.send(JSON.stringify(['success', message[1], {rev: 1}]))
				socket.send(JSON.stringify(['ot:delta', channel, {delta: [{retain: 1}, {insert: 'c'}], rev: 2}]))
			} else if (delta[0].retain === 1 && delta[1].insert === 'b' && rev === 1) {
				socket.send(JSON.stringify(['success', message[1], {rev: 3}]))
				socket.send(JSON.stringify(['ot:delta', channel, {delta: [{retain: 3}, {insert: 'd'}], rev: 4}]))
			}
		}
		Promise.all([
			client.sendDelta(channel, delta1),
			client.sendDelta(channel, delta2),
			new Promise((resolve) => {
				client.once('ot:delta', (returnChannel, returnDelta) => {
					expect(returnDelta).to.equalDelta(new Delta().retain(1).insert('c'))
					client.once('ot:delta', (returnChannel, returnDelta) => {
						expect(returnDelta).to.equalDelta(new Delta().retain(3).insert('d'))
						resolve()
					})
				})
			})
		]).then(() => {
			server.handleOtDelta = _originalHandler
			done()
		})
	})

	it('should correctly resolve conflicts: Client 2', (done) => {
		const channel = 'test-conflict-2'
		const delta1 = new Delta([{insert: 'c'}])
		const delta2 = new Delta([{retain: 1}, {insert: 'd'}])
		const _originalHandler = server.handleOtDelta
		server.handleOtDelta = function (socket, message) {
			const {delta, rev} = message[3]
			if (delta[0].insert === 'c' && rev === 0) {
				socket.send(JSON.stringify(['ot:delta', channel, {delta: [{insert: 'a'}], rev: 1}]))
				socket.send(JSON.stringify(['success', message[1], {rev: 2}]))
			} else if (delta[0].retain === 2 && delta[1].insert === 'd' && rev === 2) {
				socket.send(JSON.stringify(['ot:delta', channel, {delta: [{retain: 2}, {insert: 'b'}], rev: 3}]))
				socket.send(JSON.stringify(['success', message[1], {rev: 4}]))
			}
		}
		Promise.all([
			client.sendDelta(channel, delta1),
			client.sendDelta(channel, delta2),
			new Promise((resolve) => {
				client.once('ot:delta', (returnChannel, returnDelta) => {
					expect(returnDelta).to.equalDelta(new Delta().insert('a'))
					client.once('ot:delta', (returnChannel, returnDelta) => {
						expect(returnDelta).to.equalDelta(new Delta().retain(2).insert('b'))
						resolve()
					})
				})
			})
		]).then(() => {
			server.handleOtDelta = _originalHandler
			done()
		})
	})

	it('should buffer multiple deltas and reject all on error', (done) => {
		const channel = 'test:reject'
		const deltaInFlight = new Delta([{insert: 'Hello World'}])
		const moreDelta = new Delta([{retain: 11}, {insert: ', how'}])
		const evenMoreDelta = new Delta([{insert: 'trash'}])
		const bufferDelta = deltaInFlight.compose(evenMoreDelta).compose(moreDelta)
		const sendingDelta = new Delta([{insert: 'I AM FIRST'}])
		server.broadcastDelta(channel, sendingDelta)
		const sendFullfilled = Promise.all([
			client.sendDelta(channel, deltaInFlight),
			client.sendDelta(channel, moreDelta),
			client.sendDelta(channel, evenMoreDelta)
		])
		client.once('ot:delta', (returnChannel, returnDelta) => {
			expect(returnChannel).to.equal(channel)
			expect(returnDelta).to.equalDelta(bufferDelta.transform(sendingDelta))
			sendFullfilled.then(() => {
				done('should not succeed')
			}).catch(() => done())
		})
	})

	it('should close channels by prefix', (done) => {
		const client = new QuidditchClient(WS_URL, {token: 'hunter2'})
		client.once('joined', () => {
			return Promise.all([
				client.sendDelta('test:1:foo', new Delta().insert('a')),
				client.sendDelta('test:1:bar', new Delta().insert('b')),
				client.sendDelta('test:2:foo', new Delta().insert('c'))
			]).then(() => {
				client.closeChannels('test:1')
				expect(Object.keys(client._otChannels)).to.deep.equal(['initalChannel', 'test:2:foo'])
				client.close()
				setTimeout(done, 1)
			})
		})
	})

	it('should send throttled user:select messages', (done) => {
		const client = new QuidditchClient(WS_URL, {token: 'hunter2', sendSelectInterval: 100})
		client.once('joined', () => {
			server.messages = []
			client.sendSelect('foo')
			setTimeout(() => {
				expect(server.messages).to.deep.equal([['user:select', 'foo']])
				server.messages = []
				client.sendSelect('bar', {a: 1, b: 2})
				client.sendSelect('baz', {c: 2, d: 3})
				setTimeout(() => {
					expect(server.messages).to.deep.equal([]) // nothing after 10ms
					setTimeout(() => {
						// only last message after 100ms
						expect(server.messages).to.deep.equal([['user:select', 'baz', {c: 2, d: 3}]])
						client.close()
						setTimeout(done, 1)
					}, 100)
				}, 10)
			}, 1)
		})
	})

	it('should not send ping for old connection', (done) => {
		server.pings = 0
		const client = new QuidditchClient(WS_URL, {token: 'hunter2', pingInterval: 80, reconnectDelay: 1})
		client.once('joined', () => {
			setTimeout(() => {
				expect(server.pings).to.equal(0) // first ping should be defered by one pingInterval
				server.joinSilence = true
				client._socket.close() // but we're closing the socket in this state
				client.once('reconnecting', () => setTimeout(() => {
					expect(client.socketState).to.equal('open')
					expect(client._joinTimeout).to.exist
					expect(server.pings).to.equal(0) // has neither sent the previous nor a new ping
					server.joinSilence = false
					client.close()
					setTimeout(done, 1)
				}, 100))
			}, 10)
		})
	})

	// it('should not accept random acks', (done) => {
	// 	client.removeAllListeners('error')
	// 	client.once('error', () => done())
	// 	server.broadcastRandomAck()
	// })

	it('should error on unknown message id (success)', (done) => {
		client.removeAllListeners('error')
		client.once('warning', () => done())
		server.sendTrashSuccess()
	})

	it('should error on unknown message id (error)', (done) => {
		client.once('error', () => done())
		server.sendTrashError()
	})

	it('should detect ping timeouts and reconnect', (done) => {
		server.silence = true
		client.once('open', () => {
			server.silence = false
			done()
		})
	})

	it('should reset channels on join', (done) => {
		server.sendJoined({
			channels: {
				newChannel: {last_revision: 3}
			}
		})
		server.drop = true
		let promiseRejected = false
		let channelsReset = false
		client.sendDelta('test', new Delta([{insert: 'Hello World'}])).catch(() => {})
		client.sendDelta('test', new Delta([{retain: 1}])).catch((e) => {
			promiseRejected = true
			if (channelsReset && promiseRejected)
				done()
		})
		client.once('joined', () => {
			expect(Object.keys(client._otChannels)).to.deep.equal(['newChannel'])
			channelsReset = true
			if (channelsReset && promiseRejected)
				done()
		})
	})

	it('should close properly', (done) => {
		client.once('closed', () => {
			expect(Object.keys(client._otChannels).length).to.equal(0)
			done()
		})
		client.once('open', () => done('should not open again'))
		client.close()
	})

	it('should send user:view messages', (done) => {
		server.drop = false
		const client = new QuidditchClient(WS_URL, {token: 'hunter2', reconnectDelay: 1})
		client.once('joined', () => {
			server.messages = []
			client.sendView(['foo'])
			client.sendView(['foo'])
			setTimeout(() => {
				expect(server.messages).to.deep.equal([['user:view', ['foo']]])
				server.messages = []
				// resend last view on reconnect
				client._socket.close()
				client.once('joined', () => setTimeout(() => {
					expect(server.messages).to.deep.equal([['auth', {token: 'hunter2'}], ['user:view', ['foo']]])
					client.close()
					client.once('closed', () => done())
				}, 10))
			}, 10)
		})
	})
})
