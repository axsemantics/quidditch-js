/* global describe, before, it */

const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))

const { Delta } = require('../../dist/quidditch.js')

describe('Operational Transforms', () => {
	it('should support building methods', () => {
		const delta = new Delta()
		delta.retain(5)
		delta.insert('foo')
		delta.delete(3)

		expect(delta.ops).to.equalDelta([{retain: 5}, {insert: 'foo'}, {delete: 3}])
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
