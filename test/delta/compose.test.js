/* global describe, before, it */

const chai = require('chai')
const expect = chai.expect

const { Delta } = require('../../dist/quidditch.js')

describe('Delta.compose()', () => {
	it('should compose insert + insert', function () {
		const a = new Delta([{ insert: 'A' }])
		const b = new Delta([{ insert: 'B' }])
		const expected = new Delta([{ insert: 'BA' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert + retain', function () {
		const a = new Delta([{ insert: 'A' }])
		const b = new Delta([{ retain: 1 }])
		const expected = new Delta([{ insert: 'A' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert + delete', function () {
		const a = new Delta([{ insert: 'A' }])
		const b = new Delta([{ delete: 1 }])
		const expected = new Delta()
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + insert', function () {
		const a = new Delta([{ delete: 1 }])
		const b = new Delta([{ insert: 'B' }])
		const expected = new Delta([{ insert: 'B' }, { delete: 1 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + retain', function () {
		const a = new Delta([{ delete: 1 }])
		const b = new Delta([{ retain: 1 }])
		const expected = new Delta([{ delete: 1 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + delete', function () {
		const a = new Delta([{ delete: 1 }])
		const b = new Delta([{ delete: 1 }])
		const expected = new Delta([{ delete: 2 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + insert', function () {
		const a = new Delta([{ retain: 1 }])
		const b = new Delta([{ insert: 'B' }])
		const expected = new Delta([{ insert: 'B' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + retain', function () {
		const a = new Delta([{ retain: 1 }])
		const b = new Delta([{ retain: 1 }])
		const expected = new Delta()
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + delete', function () {
		const a = new Delta([{ retain: 1 }])
		const b = new Delta([{ delete: 1 }])
		const expected = new Delta([{ delete: 1 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert in middle of text', function () {
		const a = new Delta([{ insert: 'Hello' }])
		const b = new Delta([{ retain: 3 }, {insert: 'X'}])
		const expected = new Delta([{ insert: 'HelXlo' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert and delete ordering', function () {
		const a = new Delta([{ insert: 'Hello' }])
		const b = new Delta([{ insert: 'Hello' }])
		const insertFirst = new Delta([{ retain: 3 }, { insert: 'X' }, { delete: 1 }])
		const deleteFirst = new Delta([{ retain: 3 }, { delete: 1 }, { insert: 'X' }])
		const expected = new Delta([{ insert: 'HelXo' }])
		expect(a.compose(insertFirst)).to.deep.equal(expected)
		expect(b.compose(deleteFirst)).to.deep.equal(expected)
	})

	it('should compose delete entire text', function () {
		const a = new Delta([{ retain: 4 }, {insert: 'Hello'}])
		const b = new Delta([{ delete: 9 }])
		const expected = new Delta([{ delete: 4 }])
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should retain more than length of text', function () {
		const a = new Delta([{ insert: 'Hello' }])
		const b = new Delta([{ retain: 10 }])
		const expected = new Delta([{ insert: 'Hello' }])
		expect(a.compose(b)).to.deep.equal(expected)
	})
})
