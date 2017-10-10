/* global describe, it */

const chai = require('chai')
const expect = chai.expect

const { Delta } = require('../../dist/quidditch.js')

describe('diff()', function () {
	it('insert', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('AB')
		const expected = new Delta().retain(1).insert('B')
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('delete', function () {
		const a = new Delta().insert('AB')
		const b = new Delta().insert('A')
		const expected = new Delta().retain(1).delete(1)
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('retain', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('A')
		const expected = new Delta()
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('format', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('A', { bold: true })
		const expected = new Delta().retain(1, { bold: true })
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('object attributes', function () {
		const a = new Delta().insert('A', { font: { family: 'Helvetica', size: '15px' } })
		const b = new Delta().insert('A', { font: { family: 'Helvetica', size: '15px' } })
		const expected = new Delta()
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('error on non-documents', function () {
		const a = new Delta().insert('A')
		const b = new Delta().retain(1).insert('B')
		expect(function () {
			a.diff(b)
		}).to.throw()
		expect(function () {
			b.diff(a)
		}).to.throw()
	})

	it('inconvenient indexes', function () {
		const a = new Delta().insert('12', { bold: true }).insert('34', { italic: true })
		const b = new Delta().insert('123', { color: 'red' })
		const expected = new Delta().retain(2, { bold: null, color: 'red' }).retain(1, { italic: null, color: 'red' }).delete(1)
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('combination', function () {
		const a = new Delta().insert('Bad', { color: 'red' }).insert('cat', { color: 'blue' })
		const b = new Delta().insert('Good', { bold: true }).insert('dog', { italic: true })
		const expected = new Delta().insert('Good', { bold: true }).delete(2).retain(1, { italic: true, color: null }).delete(3).insert('og', { italic: true })
		expect(a.diff(b)).to.deep.equal(expected)
	})

	it('same document', function () {
		const a = new Delta().insert('A').insert('B', { bold: true })
		const expected = new Delta()
		expect(a.diff(a)).to.deep.equal(expected)
	})

	it('immutability', function () {
		const attr1 = { color: 'red' }
		const attr2 = { color: 'red' }
		const a1 = new Delta().insert('A', attr1)
		const a2 = new Delta().insert('A', attr1)
		const b1 = new Delta().insert('A', { bold: true }).insert('B')
		const b2 = new Delta().insert('A', { bold: true }).insert('B')
		const expected = new Delta().retain(1, { bold: true, color: null }).insert('B')
		expect(a1.diff(b1)).to.deep.equal(expected)
		expect(a1).to.deep.equal(a2)
		expect(b2).to.deep.equal(b2)
		expect(attr1).to.deep.equal(attr2)
	})

	it('non-document', function () {
		const a = new Delta().insert('Test')
		const b = new Delta().delete(4)
		expect(function () {
			a.diff(b)
		}).to.throw()
	})
})
