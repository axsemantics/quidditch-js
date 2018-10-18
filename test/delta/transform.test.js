/* global describe, it */

const chai = require('chai')
const expect = chai.expect

const { Delta } = require('../../dist/quidditch.js')

describe('Delta.transform()', () => {
	it('should transform insert + insert', function () {
		const a1 = new Delta().insert('A')
		const b1 = new Delta().insert('B')
		const expected1 = new Delta().retain(1).insert('B')
		const a2 = new Delta().insert('A')
		const b2 = new Delta().insert('B')
		const expected2 = new Delta().insert('B')
		expect(a1.transform(b1, true)).to.deep.equal(expected1)
		expect(a2.transform(b2, false)).to.deep.equal(expected2)
	})

	it('should transform insert + retain', function () {
		const a = new Delta().insert('A')
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected = new Delta().retain(1).retain(1, {attributes: { bold: true, color: 'red' }})
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform insert + delete', function () {
		const a = new Delta().insert('A')
		const b = new Delta().delete(1)
		const expected = new Delta().retain(1).delete(1)
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform delete + insert', function () {
		const a = new Delta().delete(1)
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B')
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform delete + retain', function () {
		const a = new Delta().delete(1)
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected = new Delta()
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform delete + delete', function () {
		const a = new Delta().delete(1)
		const b = new Delta().delete(1)
		const expected = new Delta()
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform retain + insert', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B')
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform retain + retain', function () {
		const a1 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b1 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const a2 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b2 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected1 = new Delta().retain(1, {attributes: { bold: true }})
		const expected2 = new Delta()
		expect(a1.transform(b1, true)).to.deep.equal(expected1)
		expect(b2.transform(a2, true)).to.deep.equal(expected2)
	})

	it('retain + retain without priority', function () {
		const a1 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b1 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected1 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const a2 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b2 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected2 = new Delta().retain(1, {attributes: { color: 'blue' }})
		expect(a1.transform(b1, false)).to.deep.equal(expected1)
		expect(b2.transform(a2, false)).to.deep.equal(expected2)
	})

	it('should transform retain + delete', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().delete(1)
		const expected = new Delta().delete(1)
		expect(a.transform(b, true)).to.deep.equal(expected)
	})

	it('should transform alternating edits', function () {
		const a1 = new Delta().retain(2).insert('si').delete(5)
		const b1 = new Delta().retain(1).insert('e').delete(5).retain(1).insert('ow')
		const expected1 = new Delta().retain(1).insert('e').delete(1).retain(2).insert('ow')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().retain(2).insert('si').delete(1)
		expect(a1.transform(b1, false)).to.deep.equal(expected1)
		expect(b2.transform(a2, false)).to.deep.equal(expected2)
	})

	it('should transform conflicting appends', function () {
		const a1 = new Delta().retain(3).insert('aa')
		const b1 = new Delta().retain(3).insert('bb')
		const expected1 = new Delta().retain(5).insert('bb')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().retain(3).insert('aa')
		expect(a1.transform(b1, true)).to.deep.equal(expected1)
		expect(b2.transform(a2, false)).to.deep.equal(expected2)
	})

	it('should transform prepend + append', function () {
		const a1 = new Delta().insert('aa')
		const b1 = new Delta().retain(3).insert('bb')
		const expected1 = new Delta().retain(5).insert('bb')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().insert('aa')
		expect(a1.transform(b1, false)).to.deep.equal(expected1)
		expect(b2.transform(a2, false)).to.deep.equal(expected2)
	})

	it('should transform trailing deletes with differing lengths', function () {
		const a1 = new Delta().retain(2).delete(1)
		const b1 = new Delta().delete(3)
		const expected1 = new Delta().delete(2)
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta()
		expect(a1.transform(b1, false)).to.deep.equal(expected1)
		expect(b2.transform(a2, false)).to.deep.equal(expected2)
	})

	it('should be immutable', function () {
		const a1 = new Delta().insert('A')
		const a2 = new Delta().insert('A')
		const b1 = new Delta().insert('B')
		const b2 = new Delta().insert('B')
		const expected = new Delta().retain(1).insert('B')
		expect(a1.transform(b1, true)).to.deep.equal(expected)
		expect(a1).to.deep.equal(a2)
		expect(b1).to.deep.equal(b2)
	})
})
