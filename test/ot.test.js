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

	it('should compose insert + insert', function () {
		var a = new Delta([{ insert: 'A' }])
		var b = new Delta([{ insert: 'B' }])
		var expected = new Delta([{ insert: 'BA' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert + retain', function () {
		var a = new Delta([{ insert: 'A' }])
		var b = new Delta([{ retain: 1 }])
		var expected = new Delta([{ insert: 'A' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert + delete', function () {
		var a = new Delta([{ insert: 'A' }])
		var b = new Delta([{ delete: 1 }])
		var expected = new Delta()
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + insert', function () {
		var a = new Delta([{ delete: 1 }])
		var b = new Delta([{ insert: 'B' }])
		var expected = new Delta([{ insert: 'B' }, { delete: 1 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + retain', function () {
		var a = new Delta([{ delete: 1 }])
		var b = new Delta([{ retain: 1 }])
		var expected = new Delta([{ delete: 1 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + delete', function () {
		var a = new Delta([{ delete: 1 }])
		var b = new Delta([{ delete: 1 }])
		var expected = new Delta([{ delete: 2 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + insert', function () {
		var a = new Delta([{ retain: 1 }])
		var b = new Delta([{ insert: 'B' }])
		var expected = new Delta([{ insert: 'B' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + retain', function () {
		var a = new Delta([{ retain: 1 }])
		var b = new Delta([{ retain: 1 }])
		var expected = new Delta()
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + delete', function () {
		var a = new Delta([{ retain: 1 }])
		var b = new Delta([{ delete: 1 }])
		var expected = new Delta([{ delete: 1 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert in middle of text', function () {
		var a = new Delta([{ insert: 'Hello' }])
		var b = new Delta([{ retain: 3 }, {insert: 'X'}])
		var expected = new Delta([{ insert: 'HelXlo' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert and delete ordering', function () {
		var a = new Delta([{ insert: 'Hello' }])
		var b = new Delta([{ insert: 'Hello' }])
		var insertFirst = new Delta([{ retain: 3 }, { insert: 'X' }, { delete: 1 }])
		var deleteFirst = new Delta([{ retain: 3 }, { delete: 1 }, { insert: 'X' }])
		var expected = new Delta([{ insert: 'HelXo' }])
		expect(a.compose(insertFirst)).to.deep.equal(expected)
		expect(b.compose(deleteFirst)).to.deep.equal(expected)
	})

	it('should compose delete entire text', function () {
		var a = new Delta([{ retain: 4 }, {insert: 'Hello'}])
		var b = new Delta([{ delete: 9 }])
		var expected = new Delta([{ delete: 4 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should retain more than length of text', function () {
		var a = new Delta([{ insert: 'Hello' }])
		var b = new Delta([{ retain: 10 }])
		var expected = new Delta([{ insert: 'Hello' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})
})
