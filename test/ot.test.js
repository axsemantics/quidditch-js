/* global describe, before, it */

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const expect = chai.expect
chai.use(sinonChai)

const { Delta } = require('../dist/quidditch.js')

describe('Operational Transforms', () => {
	it('should support building methods', () => {
		const delta = new Delta()
		delta.retain(5)
		delta.insert('foo')
		delta.delete(3)
		
		expect(delta.ops).to.deep.equal([{retain: 5}, {insert: 'foo'}, {delete: 3}])
	})
})
