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

	it('same document', function () {
		const a = new Delta().insert('A').insert('B')
		const expected = new Delta()
		expect(a.diff(a)).to.deep.equal(expected)
	})

	it('non-document', function () {
		const a = new Delta().insert('Test')
		const b = new Delta().delete(4)
		expect(function () {
			a.diff(b)
		}).to.throw()
	})
})
