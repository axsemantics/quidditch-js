/* global describe, before, it */

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const expect = chai.expect
chai.use(sinonChai)

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

	it('should connect', (done) => {
		client = new QuidditchClient(WS_URL, {pingInterval: 300, reconnectDelay: 300, token: 'hunter2'})
		client.once('open', done)
		client.on('error', (error) => {
			throw new Error(error) // let us hear the screams
		})
	})

	it('should authenticate & join automatically', (done) => {
		client.once('joined', (data) => {
			expect(data).to.contain.all.keys('project', 'additionalData', 'channels')
			expect(data.project).to.equal('my-project')
			expect(client._otChannels['initalChannel'].rev).to.equal(7)
			done()
		})
	})

	it('should ping', (done) => {
		let counter = 0
		const count = () => {
			client.once('pong', () => {
				counter++
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
			expect(error).to.equal('NOT A NUMBER!')
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

	it('should send a delta and handle the ack', (done) => {
		const channel = 'test:1234'
		client.sendDelta(channel, new Delta([{insert: 'Hello World'}])).then(() => done())
	})

	it('should handle broken delta with error', (done) => {
		const channel = 'test:trash'
		client.sendDelta(channel, new Delta([{insert: 'trash'}])).then(() => {
			done('should not succeed')
		}).catch((error) => {
			expect(error).to.equal('trashy request')
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
			expect(returnDelta).to.deep.equal(delta)
			done()
		})
	})

	it('should receive a delta on a new channel', (done) => {
		const channel = 'test:extern'
		const delta = new Delta([{insert: 'Hello World'}])
		server.broadcastDelta(channel, delta)
		client.once('ot:delta', (returnChannel, returnDelta) => {
			expect(returnChannel).to.equal(channel)
			expect(returnDelta).to.deep.equal(delta)
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
			expect(returnDelta).to.deep.equal(deltaInFlight.transform(sendingDelta))
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
			expect(returnDelta).to.deep.equal(bufferDelta.transform(sendingDelta))
			sendFullfilled.then(() => done())
		})
	})

	it('should buffer multiple deltas and reject all on error', (done) => {
		const channel = 'test:123456'
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
			expect(returnDelta).to.deep.equal(bufferDelta.transform(sendingDelta))
			sendFullfilled.then(() => {
				done('should not succeed')
			}).catch(() => done())
		})
	})

	// it('should not accept random acks', (done) => {
	// 	client.removeAllListeners('error')
	// 	client.once('error', () => done())
	// 	server.broadcastRandomAck()
	// })

	it('should error on unknown message id (success)', (done) => {
		client.removeAllListeners('error')
		client.once('error', () => done())
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

	it('should close properly', (done) => {
		client.once('closed', () => done())
		client.once('open', () => done('should not open again'))
		client.close()
	})
})
