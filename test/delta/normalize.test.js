/* global describe, it */

const chai = require('chai')
chai.use(require('../delta-string-utils'))
const expect = chai.expect

const { Delta, DeltaString } = require('../../dist/quidditch.js')

describe('Delta normalize', () => {
	it('should normalize inserts', () => {
		const delta1 = new Delta([{insert: 'ab '}, {insert: 'c'}])
		const delta2 = new Delta().insert('ab c')

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should deeply normalize inserts', () => {
		const delta1 = new Delta().insert({items: [{insert: 'ab '}, {insert: 'c'}]})
		const delta2 = new Delta().insert({items: [{insert: 'ab c'}]})

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should deeply normalize inserts in retain', () => {
		const delta1 = new Delta().retain(1, {subOps: [{insert: 'ab '}, {insert: 'c'}]})
		const delta2 = new Delta().retain(1, {subOps: [{insert: 'ab c'}]})

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should deeply normalize inserts in multiple sub ops', () => {
		const delta1 = new Delta().retain(1, {subOps: {
			foo: [{insert: 'ab'}, {insert: 'c'}],
			bar: [{insert: 'd'}, {insert: 'ef'}]
		}})
		const delta2 = new Delta().retain(1, {subOps: {
			foo: [{insert: 'abc'}],
			bar: [{insert: 'def'}]
		}})

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should normalize retains', () => {
		const delta1 = new Delta([{retain: 2}, {retain: 2}])
		const delta2 = new Delta().retain(4)

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should deeply normalize retains', () => {
		const delta1 = new Delta().insert({items: [{retain: 2}, {retain: 2}]})
		const delta2 = new Delta().insert({items: [{retain: 4}]})

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should normalize delete', () => {
		const delta1 = new Delta([{delete: 2}, {delete: 2}])
		const delta2 = new Delta().delete(4)

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})

	it('should deeply normalize delete', () => {
		const delta1 = new Delta().insert({items: [{delete: 2}, {delete: 2}]})
		const delta2 = new Delta().insert({items: [{delete: 4}]})

		expect(delta1.normalize().ops).to.equalDelta(delta2.ops)
	})
})
