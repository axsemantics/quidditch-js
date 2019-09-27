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
		const b = new Delta().insert('A', {attributes: { bold: true }})
		const expected = new Delta().retain(1, {attributes: { bold: true }})
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('object attributes', function () {
		const a = new Delta().insert('A', {attributes: { font: { family: 'Helvetica', size: '15px' } }})
		const b = new Delta().insert('A', {attributes: { font: { family: 'Helvetica', size: '15px' } }})
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
		const a = new Delta().insert('12', {attributes: { bold: true }}).insert('34', {attributes: { italic: true }})
		const b = new Delta().insert('123', {attributes: { color: 'red' }})
		const expected = new Delta().retain(2, {attributes: { bold: null, color: 'red' }}).retain(1, {attributes: { italic: null, color: 'red' }}).delete(1)
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('combination', function () {
		const a = new Delta().insert('Bad', {attributes: { color: 'red' }}).insert('cat', {attributes: { color: 'blue' }})
		const b = new Delta().insert('Good', {attributes: { bold: true }}).insert('dog', {attributes: { italic: true }})
		const expected = new Delta().insert('Good', {attributes: { bold: true }}).delete(2).retain(1, {attributes: { italic: true, color: null }}).delete(3).insert('og', {attributes: { italic: true }})
		expect(a.diff(b)).to.equalDelta(expected)
	})

	it('same document', function () {
		const a = new Delta().insert('A').insert('B', {attributes: { bold: true }})
		const expected = new Delta()
		expect(a.diff(a)).to.equalDelta(expected)
	})

	it('immutability', function () {
		const attr1 = { color: 'red' }
		const attr2 = { color: 'red' }
		const a1 = new Delta().insert('A', {attributes: attr1})
		const a2 = new Delta().insert('A', {attributes: attr1})
		const b1 = new Delta().insert('A', {attributes: { bold: true }}).insert('B')
		const b2 = new Delta().insert('A', {attributes: { bold: true }}).insert('B')
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
})
