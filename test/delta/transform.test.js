/* global describe, it */

const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))

const { Delta } = require('../../dist/quidditch.js')
const fixtures = require('./fixtures')

describe('Delta.transform()', () => {
	it('should transform insert + insert', function () {
		const a1 = new Delta().insert('A')
		const b1 = new Delta().insert('B')
		const expected1 = new Delta().retain(1).insert('B')
		const a2 = new Delta().insert('A')
		const b2 = new Delta().insert('B')
		const expected2 = new Delta().insert('B')
		expect(a1.transform(b1, true)).to.equalDelta(expected1)
		expect(a2.transform(b2, false)).to.equalDelta(expected2)
	})

	it('should transform insert + retain', function () {
		const a = new Delta().insert('A')
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected = new Delta().retain(1).retain(1, {attributes: { bold: true, color: 'red' }})
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform insert + delete', function () {
		const a = new Delta().insert('A')
		const b = new Delta().delete(1)
		const expected = new Delta().retain(1).delete(1)
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform delete + insert', function () {
		const a = new Delta().delete(1)
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B')
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform delete + retain', function () {
		const a = new Delta().delete(1)
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected = new Delta()
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform delete + delete', function () {
		const a = new Delta().delete(1)
		const b = new Delta().delete(1)
		const expected = new Delta()
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform retain + insert', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B')
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform retain + retain', function () {
		const a1 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b1 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const a2 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b2 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected1 = new Delta().retain(1, {attributes: { bold: true }})
		const expected2 = new Delta()
		expect(a1.transform(b1, true)).to.equalDelta(expected1)
		expect(b2.transform(a2, true)).to.equalDelta(expected2)
	})

	it('retain + retain without priority', function () {
		const a1 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b1 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected1 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const a2 = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b2 = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected2 = new Delta().retain(1, {attributes: { color: 'blue' }})
		expect(a1.transform(b1, false)).to.equalDelta(expected1)
		expect(b2.transform(a2, false)).to.equalDelta(expected2)
	})

	it('should transform retain + delete', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().delete(1)
		const expected = new Delta().delete(1)
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform alternating edits', function () {
		const a1 = new Delta().retain(2).insert('si').delete(5)
		const b1 = new Delta().retain(1).insert('e').delete(5).retain(1).insert('ow')
		const expected1 = new Delta().retain(1).insert('e').delete(1).retain(2).insert('ow')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().retain(2).insert('si').delete(1)
		expect(a1.transform(b1, false)).to.equalDelta(expected1)
		expect(b2.transform(a2, false)).to.equalDelta(expected2)
	})

	it('should transform conflicting appends', function () {
		const a1 = new Delta().retain(3).insert('aa')
		const b1 = new Delta().retain(3).insert('bb')
		const expected1 = new Delta().retain(5).insert('bb')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().retain(3).insert('aa')
		expect(a1.transform(b1, true)).to.equalDelta(expected1)
		expect(b2.transform(a2, false)).to.equalDelta(expected2)
	})

	it('should transform conflicting appends', function () {
		const a1 = new Delta().retain(1).insert('b')
		const b1 = new Delta().retain(1).insert('c')
		const expected1 = new Delta().retain(1).insert('c')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().retain(2).insert('c')
		expect(a1.transform(b1, false)).to.equalDelta(expected1)
		expect(a2.transform(b2, true)).to.equalDelta(expected2)
	})

	it('should transform prepend + append', function () {
		const a1 = new Delta().insert('aa')
		const b1 = new Delta().retain(3).insert('bb')
		const expected1 = new Delta().retain(5).insert('bb')
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta().insert('aa')
		expect(a1.transform(b1, false)).to.equalDelta(expected1)
		expect(b2.transform(a2, false)).to.equalDelta(expected2)
	})

	it('should transform trailing deletes with differing lengths', function () {
		const a1 = new Delta().retain(2).delete(1)
		const b1 = new Delta().delete(3)
		const expected1 = new Delta().delete(2)
		const a2 = new Delta(a1.ops)
		const b2 = new Delta(b1.ops)
		const expected2 = new Delta()
		expect(a1.transform(b1, false)).to.equalDelta(expected1)
		expect(b2.transform(a2, false)).to.equalDelta(expected2)
	})

	it('should be immutable', function () {
		const a1 = new Delta().insert('A')
		const a2 = new Delta().insert('A')
		const b1 = new Delta().insert('B')
		const b2 = new Delta().insert('B')
		const expected = new Delta().retain(1).insert('B')
		expect(a1.transform(b1, true)).to.equalDelta(expected)
		expect(a1).to.equalDelta(a2)
		expect(b1).to.equalDelta(b2)
	})

	it('should transform subOps and set', function () {
		const a = new Delta().delete(4).retain(1, {set: {id: 'abc'}, subOps: {lemma: []}})
		const b = new Delta().retain(4).retain(1, {set: {container_type: 'foo'}, subOps: {text: new Delta().insert('bar').ops}})
		const expected = [{retain: 1, $set: {container_type: 'foo'}, $sub: {text: [{insert: 'bar'}]}}]
		expect(a.transform(b, true).ops).to.equalDelta(expected)
	})

	it('should transform $sub deep text', function () {
		const a = new Delta().retain(2).retain(1, {subOps: [fixtures.opRetainA(), fixtures.opRetainB()]})
		const b = new Delta().delete(2).retain(1, {subOps: [{
			retain: 1,
			$sub: [{
				retain: 1,
				$sub: [{
					retain: 1,
					$sub: {text: [{insert: 'c'}]},
					$set: {
						text: 'bla',
						attributes: {gender: 'm'}
					}}
				]}
			]},
		{
			retain: 1,
			$sub: {text: [{insert: 'd'}]}}
		]})
		const expected = new Delta().delete(2).retain(1, {subOps: [{
			retain: 1,
			$sub: [{
				retain: 1,
				$sub: [{
					retain: 1,
					$sub: {text: [{retain: 1}, {insert: 'c'}]},
					$set: {
						text: 'bla',
					}}
				]}
			]},
		{
			retain: 1,
			$sub: {text: [{retain: 1}, {insert: 'd'}]}}
		]})
		expect(a.transform(b, true)).to.equalDelta(expected)
	})

	it('should transform $sub with delete + retain', function () {
		const a = new Delta().retain(2).retain(1, {subOps: [{delete: 1}, fixtures.opRetainB()]})
		const b = new Delta().delete(2).retain(1, {subOps: [
			fixtures.opRetainA(), {
				retain: 2,
				$sub: {
					text: [
						{insert: 'd'}
					]
				}
			}
		]})
		const expected = new Delta().delete(2).retain(1, {subOps: [{
			retain: 1,
			$sub: {
				text: [
					{retain: 1},
					{insert: 'd'}
				]
			}
		}, {
			retain: 1,
			$sub: {
				text: [
					{insert: 'd'}
				]
			}
		}]})
		expect(a.transform(b, true)).to.equalDelta(expected)
	})
})

describe('Delta.transformPosition()', () => {
	it('should transform flat positions', function () {
		expect(new Delta().delete(2).transformPosition([5])).eql([3])
		expect(new Delta().delete(5).transformPosition([5])).eql([0])
		expect(new Delta().delete(7).transformPosition([5])).eql([0])
		expect(new Delta().retain(5).delete(3).transformPosition([5])).eql([2])
		expect(new Delta().retain(6).delete(3).transformPosition([5])).eql([5])
		expect(new Delta().insert('a').transformPosition([5])).eql([6])
		expect(new Delta().retain(4).insert('bcd').transformPosition([5])).eql([8])
		expect(new Delta().retain(5).insert('bcd').transformPosition([5])).eql([8])
		expect(new Delta().retain(5).insert('bcd').transformPosition([5], true)).eql([5])
		expect(new Delta().retain(7).insert('d').transformPosition([5])).eql([5])
	})

	it('should transform nested positions', function () {
		expect(new Delta().delete(2).transformPosition([3, 2, 3])).eql([1, 2, 3])
		expect(new Delta().insert('foo').transformPosition([1, 2, 3])).eql([4, 2, 3])
		expect(new Delta().delete(2).transformPosition([1, 2, 3])).eql([0])

		const d1 = new Delta().insert('barbaz').retain(2, {subOps: new Delta().insert('foo').delete(3)})
		expect(d1.transformPosition([1, 2, 3])).eql([7, 2])
		expect(d1.transformPosition([0, 0, 3])).eql([6, 0])
		expect(d1.transformPosition([1, 3, 3])).eql([7, 3, 3])
		expect(d1.transformPosition([3, 4, 5])).eql([9, 4, 5])

		const d2 = new Delta().retain(1, {subOps: new Delta().retain(3).retain(1, {subOps: {text: [{delete: 3}]}})})
		expect(d2.transformPosition([0, 3, 2])).eql([0, 3, 0])
		expect(d2.transformPosition([0, 3, 5])).eql([0, 3, 2])

		const d3 = new Delta().retain(1, {subOps: new Delta().retain(3).insert('ab')})
		expect(d3.transformPosition([0, 3, 1], false)).eql([0, 5, 1])
		expect(d3.transformPosition([0, 3, 1], true)).eql([0, 3, 1])
	})
})
