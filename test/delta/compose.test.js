/* global describe, it */

const chai = require('chai')
const expect = chai.expect

const { Delta } = require('../../dist/quidditch.js')

describe('Delta.compose()', () => {
	it('should compose insert + insert', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('B')
		const expected = new Delta().insert('BA')
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert + retain', function () {
		const a = new Delta().insert('A')
		const b = new Delta().retain(1, { bold: true, color: 'red', font: null })
		const expected = new Delta().insert('A', { bold: true, color: 'red' })
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert + delete', function () {
		const a = new Delta().insert('A')
		const b = new Delta().delete(1)
		const expected = new Delta()
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + insert', function () {
		const a = new Delta().delete(1)
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B').delete(1)
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + retain', function () {
		const a = new Delta().delete(1)
		const b = new Delta().retain(1, { bold: true, color: 'red' })
		const expected = new Delta().delete(1).retain(1, { bold: true, color: 'red' })
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + delete', function () {
		const a = new Delta().delete(1)
		const b = new Delta().delete(1)
		const expected = new Delta().delete(2)
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + insert', function () {
		const a = new Delta().retain(1, { color: 'blue' })
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B').retain(1, { color: 'blue' })
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + retain', function () {
		const a = new Delta().retain(1, { color: 'blue' })
		const b = new Delta().retain(1, { bold: true, color: 'red', font: null })
		const expected = new Delta().retain(1, { bold: true, color: 'red', font: null })
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + delete', function () {
		const a = new Delta().retain(1, { color: 'blue' })
		const b = new Delta().delete(1)
		const expected = new Delta().delete(1)
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert in middle of text', function () {
		const a = new Delta().insert('Hello')
		const b = new Delta().retain(3).insert('X')
		const expected = new Delta().insert('HelXlo')
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert and delete ordering', function () {
		const a = new Delta().insert('Hello')
		const b = new Delta().insert('Hello')
		const insertFirst = new Delta().retain(3).insert('X').delete(1)
		const deleteFirst = new Delta().retain(3).delete(1).insert('X')
		const expected = new Delta().insert('HelXo')
		expect(a.compose(insertFirst)).to.deep.equal(expected)
		expect(b.compose(deleteFirst)).to.deep.equal(expected)
	})

	it('should compose delete entire text', function () {
		const a = new Delta().retain(4).insert('Hello')
		const b = new Delta().delete(9)
		const expected = new Delta().delete(4)
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should retain more than length of text', function () {
		const a = new Delta().insert('Hello')
		const b = new Delta().retain(10)
		const expected = new Delta().insert('Hello')
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should remove all attributes', function () {
		const a = new Delta().insert('A', { bold: true })
		const b = new Delta().retain(1, { bold: null })
		const expected = new Delta().insert('A')
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('shoulb be immutable', function () {
		const attr1 = { bold: true }
		const attr2 = { bold: true }
		const a1 = new Delta().insert('Test', attr1)
		const a2 = new Delta().insert('Test', attr1)
		const b1 = new Delta().retain(1, { color: 'red' }).delete(2)
		const b2 = new Delta().retain(1, { color: 'red' }).delete(2)
		const expected = new Delta().insert('T', { color: 'red', bold: true }).insert('t', attr1)
		expect(a1.compose(b1)).to.deep.equal(expected)
		expect(a1).to.deep.equal(a2)
		expect(b1).to.deep.equal(b2)
		expect(attr1).to.deep.equal(attr2)
	})
})
