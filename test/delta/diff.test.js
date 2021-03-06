/* global describe, it */

const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))

const { Delta } = require('../../dist/quidditch.js')

describe('diff()', function () {
	it('insert', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('AB')
		const expected = new Delta().retain(1).insert('B')
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('delete', function () {
		const a = new Delta().insert('AB')
		const b = new Delta().insert('A')
		const expected = new Delta().retain(1).delete(1)
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('retain', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('A')
		const expected = new Delta()
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('format', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('A', { bold: true })
		const expected = new Delta().retain(1, {attributes: { bold: true }})
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('object attributes', function () {
		const a = new Delta().insert('A', { font: { family: 'Helvetica', size: '15px' } })
		const b = new Delta().insert('A', { font: { family: 'Helvetica', size: '15px' } })
		const expected = new Delta()
		expect(a.diff(b)).to.equalDelta(expected)
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
		const expected = new Delta().retain(2, {attributes: { bold: null, color: 'red' }}).retain(1, {attributes: { italic: null, color: 'red' }}).delete(1)
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('combination', function () {
		const a = new Delta().insert('Bad', { color: 'red' }).insert('cat', { color: 'blue' })
		const b = new Delta().insert('Good', { bold: true }).insert('dog', { italic: true })
		const expected = new Delta().insert('Good', { bold: true }).delete(2).retain(1, {attributes: { italic: true, color: null }}).delete(3).insert('og', { italic: true })
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('same document', function () {
		const a = new Delta().insert('A').insert('B', { bold: true })
		const expected = new Delta()
		expect(a.diff(a)).to.equalDelta(expected)
	})

	it('immutability', function () {
		const attr1 = { color: 'red' }
		const attr2 = { color: 'red' }
		const a1 = new Delta().insert('A', attr1)
		const a2 = new Delta().insert('A', attr1)
		const b1 = new Delta().insert('A', { bold: true }).insert('B')
		const b2 = new Delta().insert('A', { bold: true }).insert('B')
		const expected = new Delta().retain(1, {attributes: { bold: true, color: null }}).insert('B')
		expect(a1.diff(b1)).to.equalDelta(expected)
		expect(a1).to.equalDelta(a2)
		expect(b2).to.equalDelta(b2)
		expect(attr1).to.equalDelta(attr2)
	})

	it('non-document', function () {
		const a = new Delta().insert('Test')
		const b = new Delta().delete(4)
		expect(function () {
			a.diff(b)
		}).to.throw()
	})

	it('emoji', function () {
		const a = new Delta().insert('🌀-🌀-🌀')
		const b = new Delta().insert('🔥-🌀-🌀')
		const c = new Delta().insert('🌀-🔥-🌀')
		const d = new Delta().insert('🌀-🌀-🔥')
		const expected1 = new Delta().delete(1).insert('🔥')
		const expected2 = new Delta().retain(2).delete(1).insert('🔥')
		const expected3 = new Delta().retain(4).delete(1).insert('🔥')
		expect(a.diff(b)).to.equalDelta(expected1)
		expect(a.diff(c)).to.equalDelta(expected2)
		expect(a.diff(d)).to.equalDelta(expected3)
	})
})
