/* global describe, before, it */

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const expect = chai.expect
chai.use(sinonChai)

const server = require('./mock-server')
const { QuidditchClient, Delta } = require('../dist/quidditch.js')

const PORT = 9436
const WS_URL = 'ws://localhost:9436'
// const WS_URL = 'wss://api-stage.ax-semantics.com/ws/rohrpost/'
let client = null
describe('Quidditch Client', () => {
	before(function (done) {
		server.init({
			port: PORT
		}, done)
	})

	it('should connect', (done) => {
		client = new QuidditchClient(WS_URL, {pingInterval: 300, token: 'hunter2'})
		client.once('open', done)
		client.on('error', (error) => {
			throw new Error(error) // let us hear the screams
		})
	})

	it('should authenticate automatically', (done) => {
		client.once('authenticated', done)
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

	it('should join', (done) => {
		client.join(42)
		client.once('joined', (data) => {
			expect(data).to.contain.all.keys('project', 'additionalData')
			expect(data.project).to.equal(42)
			done()
		})
	})

	it('should handle a generic call', (done) => {
		client.call('generic:increment', {number: 3})
		client.once('message', (message) => {
			expect(message[0]).to.equal('generic:incremented')
			expect(message[1]).to.contain.all.keys('number')
			expect(message[1].number).to.equal(4)
			done()
		})
	})

	it('should send a delta and handle the ack', (done) => {
		const channel = 'test:1234'
		client.sendDelta(channel, new Delta([{insert: 'Hello World'}]))
		client.once('ot:ack', (returnChannel) => {
			expect(returnChannel).to.equal.channel
			done()
		})
	})

	it('should send a delta and buffer', (done) => {
		const channel = 'test:1234'
		client.sendDelta(channel, new Delta([{insert: 'Hello World'}]))
		client.sendDelta(channel, new Delta([{insert: 'Hello World'}]))
		client.once('ot:ack', (returnChannel) => {
			expect(returnChannel).to.equal.channel
			client.once('ot:ack', (returnChannel) => {
				expect(returnChannel).to.equal.channel
				done()
			})
		})
	})

	it('should receive a delta and apply')

	it('should receive a delta and transform')
})
