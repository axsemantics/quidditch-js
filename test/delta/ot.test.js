/* global describe, before, it */

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const expect = chai.expect
chai.use(sinonChai)

const { Delta } = require('../../dist/quidditch.js')
const fixtures = require('./fixtures')

describe('Operational Transforms', () => {
	it('should support building methods', () => {
		const delta = new Delta()
		delta.retain(5)
		delta.insert('foo')
		delta.delete(3)

		expect(delta.ops).to.deep.equal([{retain: 5}, {insert: 'foo'}, {delete: 3}])
	})

	it('should merge same ops', () => {
		let delta = new Delta([{retain: 1}])
		delta.retain(3)
		expect(delta.ops).to.deep.equal([{retain: 4}])

		delta = new Delta([{delete: 2}, {insert: 'foo'}])
		delta.insert('bar')
		expect(delta.ops).to.deep.equal([{delete: 2}, {insert: 'foobar'}])

		delta = new Delta([{delete: 5}])
		delta.delete(2)
		expect(delta.ops).to.deep.equal([{delete: 7}])
	})

	it('should apply delta to string', () => {
		const delta = new Delta([
			{retain: 6},
			{delete: 8},
			{insert: 'Percival Wulfric Brian'}
		])

		expect(delta.apply('Albus P. W. B. Dumbledore')).to.equal('Albus Percival Wulfric Brian Dumbledore')
	})

	it('should expose static diff function', () => {
		Delta.diff('a', 'b')
	})
})
