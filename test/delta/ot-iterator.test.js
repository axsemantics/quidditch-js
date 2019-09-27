/* global describe, beforeEach, it */

const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))

const { Delta, OpIterator } = require('../../dist/quidditch.js')

describe('op iterator', function () {
	beforeEach(function () {
		this.delta = new Delta().insert('Hello', {attributes: { bold: true }}).retain(3).delete(4)
	})

	it('hasNext() true', function () {
		const iter = new OpIterator(this.delta.ops)
		expect(iter.hasNext()).to.equal(true)
	})

	it('hasNext() false', function () {
		const iter = new OpIterator([])
		expect(iter.hasNext()).to.equal(false)
	})

	it('peek()', function () {
		const iter = new OpIterator(this.delta.ops)
		expect(iter.peek()).to.equal(this.delta.ops[0])
	})

	it('peekLength() offset === 0', function () {
		const iter = new OpIterator(this.delta.ops)
		expect(iter.peekLength()).to.equal(5)
		iter.next()
		expect(iter.peekLength()).to.equal(3)
		iter.next()
		expect(iter.peekLength()).to.equal(4)
	})

	it('peekLength() offset > 0', function () {
		const iter = new OpIterator(this.delta.ops)
		iter.next(2)
		expect(iter.peekLength()).to.equal(5 - 2)
	})

	it('peekLength() no ops left', function () {
		const iter = new OpIterator([])
		expect(iter.peekLength()).to.equal(Infinity)
	})

	it('peekType()', function () {
		const iter = new OpIterator(this.delta.ops)
		expect(iter.peekType()).to.equal('insert')
		iter.next()
		expect(iter.peekType()).to.equal('retain')
		iter.next()
		expect(iter.peekType()).to.equal('delete')
		iter.next()
		expect(iter.peekType()).to.equal('retain')
	})

	it('next()', function () {
		const iter = new OpIterator(this.delta.ops)
		for (let i = 0; i < this.delta.ops.length; i += 1) {
			expect(iter.next()).to.equalDelta(this.delta.ops[i])
		}
		expect(iter.next()).to.deep.equal({ retain: Infinity })
		expect(iter.next(4)).to.deep.equal({ retain: Infinity })
		expect(iter.next()).to.deep.equal({ retain: Infinity })
	})

	it('next(length)', function () {
		const iter = new OpIterator(this.delta.ops)
		expect(iter.next(2)).to.equalDelta({ insert: 'He', attributes: { bold: true } })
		expect(iter.next(10)).to.equalDelta({ insert: 'llo', attributes: { bold: true } })
		expect(iter.next(1)).to.deep.equal({ retain: 1 })
		expect(iter.next(2)).to.deep.equal({ retain: 2 })
	})

	it('next with Set', function () {
		const iter = new OpIterator(new Delta().insert('a-key', {set: {a: 1}}).ops)
		expect(iter.next()).to.deep.equal({ insert: 'a-key', $set: {a: 1} })
	})
})
