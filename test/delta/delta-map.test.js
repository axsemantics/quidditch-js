/* global describe,  it */
/* eslint no-unused-expressions: 0 */

const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))
const { Delta } = require('../../dist/quidditch.js')
const fixtures = require('./fixtures')

describe('Delta Map', function () {
	it('should insert into set', function () {
		const delta = new Delta().insert('a-key', {set: {a: 1, b: 'two'}})
		expect(delta.ops[0]).to.deep.equal({insert: 'a-key', $set: {a: 1, b: 'two'}})
	})
	it('should retain into set', function () {
		const delta = new Delta().retain('a-key', {set: {a: 1, b: 'two'}})
		expect(delta.ops[0]).to.deep.equal({retain: 'a-key', $set: {a: 1, b: 'two'}})
	})
	it('should retain into set with subOps', function () {
		const delta = new Delta().retain('a-key', {subOps: [{insert: 'a'}]})
		expect(delta.ops[0]).to.equalDelta({retain: 'a-key', $sub: [{insert: 'a'}]})
	})
	it('should delete from set', function () {
		const delta = new Delta().delete('a-key')
		expect(delta.ops[0]).to.deep.equal({delete: 'a-key'})
	})

	// compose
	it('should compose different insert + insert', function () {
		const a = new Delta().insert('a-key', {set: {a: 1}})
		const b = new Delta().insert('b-key', {set: {a: 1}})
		const expected = new Delta().insert('a-key', {set: {a: 1}}).insert('b-key', {set: {a: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose same insert + insert', function () {
		const a = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().insert('a-key', {set: {a: 2}})
		const expected = new Delta().insert('a-key', {set: {a: 2}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose different insert + retain', function () {
		const a = new Delta().insert('a-key', {set: {a: 1}})
		const b = new Delta().retain('b-key', {set: {a: 1}})
		const expected = new Delta().insert('a-key', {set: {a: 1}}).retain('b-key', {set: {a: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose same insert + retain', function () {
		const a = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().retain('a-key', {set: {a: 2}})
		const expected = new Delta().insert('a-key', {set: {a: 2, b: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose different retain + insert', function () {
		const a = new Delta().retain('a-key', {set: {a: 1}})
		const b = new Delta().insert('b-key', {set: {a: 1}})
		const expected = new Delta().retain('a-key', {set: {a: 1}}).insert('b-key', {set: {a: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose same retain + insert', function () {
		const a = new Delta().retain('a-key', {set: {a: 1, b: 2}})
		const b = new Delta().insert('a-key', {set: {a: 2}})
		const expected = new Delta().insert('a-key', {set: {a: 2}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose different retain + retain', function () {
		const a = new Delta().retain('a-key', {set: {a: 1}})
		const b = new Delta().retain('b-key', {set: {a: 1}})
		const expected = new Delta().retain('a-key', {set: {a: 1}}).retain('b-key', {set: {a: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose same retain + retain', function () {
		const a = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().retain('a-key', {set: {a: 2}})
		const expected = new Delta().retain('a-key', {set: {a: 2, b: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose insert + delete', function () {
		const a = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().delete('a-key')
		const expected = new Delta().delete('a-key')
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose retain + delete', function () {
		const a = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().delete('a-key')
		const expected = new Delta().delete('a-key')
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose delete + delete', function () {
		const a = new Delta().delete('a-key')
		const b = new Delta().delete('a-key')
		const expected = new Delta().delete('a-key')
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose delete + retain', function () {
		const a = new Delta().delete('a-key')
		const b = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const expected = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})
	it('should compose delete + insert', function () {
		const a = new Delta().delete('a-key')
		const b = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const expected = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose deep ratain + retain $sub', function () {
		const a = new Delta().retain('a-key', {subOps: [fixtures.opRetainA()]})
		const b = new Delta().retain('a-key', {subOps: [{retain: 1}, fixtures.opRetainB()]})
		const expected = new Delta().retain('a-key', {subOps: [fixtures.opRetainA(), fixtures.opRetainB()]})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose insert + retain $sub', function () {
		const a = new Delta().insert('a-key', {set: {_t: 'mapItem', itemDelta: [fixtures.opRetainA()]}})
		const b = new Delta().retain('a-key', {subOps: {itemDelta: [{retain: 1}, fixtures.opRetainB()]}})
		const expected = new Delta().insert('a-key', {set: {_t: 'mapItem', itemDelta: [fixtures.opRetainA(), fixtures.opRetainB()]}})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose insert + retain mappy object', function () {
		const a = new Delta().insert({
			_t: 'mapParent',
			items: new Delta().insert('a-key', {set: {_t: 'mapItem', itemDelta: [fixtures.opRetainA()]}}).ops
		})
		const b = new Delta().retain(1, {subOps: {
			items: [
				{retain: 'a-key', $sub: {itemDelta: [{retain: 1}, fixtures.opRetainB()]}},
				{insert: 'b-key', $set: {_t: 'mapItem', itemDelta: [fixtures.opRetainB()]}}
			]
		}})
		const expected = new Delta().insert({
			_t: 'mapParent',
			items: new Delta().insert('a-key', {set: {_t: 'mapItem', itemDelta: [fixtures.opRetainA(), fixtures.opRetainB()]}}).insert('b-key', {set: {_t: 'mapItem', itemDelta: [fixtures.opRetainB()]}}).ops
		})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	// transform
	it('should transform different insert + insert', function () {
		const a = new Delta().insert('a-key', {set: {a: 1}})
		const b = new Delta().insert('b-key', {set: {a: 1}})
		const expected = new Delta().insert('b-key', {set: {a: 1}})
		expect(a.transform(b)).to.equalDelta(expected)
		expect(a.transform(b, true)).to.equalDelta(expected)
	})
	it('should transform same insert + insert', function () {
		const a = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().insert('a-key', {set: {a: 2}})
		// if a happens after b (no priority), b did not happen at all
		const expected1 = new Delta()
		const expected2 = new Delta().insert('a-key', {set: {a: 2}})
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform different insert + retain', function () {
		const a = new Delta().insert('a-key', {set: {a: 1}})
		const b = new Delta().retain('b-key', {set: {a: 1}})
		const expected = new Delta().retain('b-key', {set: {a: 1}})
		expect(a.transform(b)).to.equalDelta(expected)
		expect(a.transform(b, true)).to.equalDelta(expected)
	})
	it('should transform same insert + retain', function () {
		const a = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().retain('a-key', {set: {a: 2}})
		const expected1 = new Delta() // retain gets wiped by later insert
		const expected2 = new Delta().retain('a-key', {set: {a: 2}})
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform different retain + insert', function () {
		const a = new Delta().retain('a-key', {set: {a: 1}})
		const b = new Delta().insert('b-key', {set: {a: 1}})
		const expected = new Delta().insert('b-key', {set: {a: 1}})
		expect(a.transform(b)).to.equalDelta(expected)
		expect(a.transform(b, true)).to.equalDelta(expected)
	})
	it('should transform same retain + insert', function () {
		const a = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().insert('a-key', {set: {a: 2, c: 3}})
		const expected1 = new Delta().insert('a-key', {set: {a: 1, b: 1, c: 3}})
		const expected2 = new Delta().insert('a-key', {set: {a: 2, c: 3}})
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform different retain + retain', function () {
		const a = new Delta().retain('a-key', {set: {a: 1}})
		const b = new Delta().retain('b-key', {set: {a: 1}})
		const expected = new Delta().retain('b-key', {set: {a: 1}})
		expect(a.transform(b)).to.equalDelta(expected)
		expect(a.transform(b, true)).to.equalDelta(expected)
	})
	it('should transform same retain + retain', function () {
		const a = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().retain('a-key', {set: {a: 2, c: 3}})
		const expected1 = new Delta().insert('a-key', {set: {c: 3}})
		const expected2 = new Delta().retain('a-key', {set: {a: 2, c: 3}})
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform insert + delete', function () {
		const a = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().delete('a-key')
		const expected1 = new Delta()
		const expected2 = new Delta().delete('a-key')
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform retain + delete', function () {
		const a = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const b = new Delta().delete('a-key')
		// always delete, cannot retain on a deleted object
		const expected1 = new Delta().delete('a-key')
		const expected2 = new Delta().delete('a-key')
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform delete + delete', function () {
		const a = new Delta().delete('a-key')
		const b = new Delta().delete('a-key')
		// it either has been or is gonna be deleted anyways
		const expected1 = new Delta()
		const expected2 = new Delta()
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform delete + retain', function () {
		const a = new Delta().delete('a-key')
		const b = new Delta().retain('a-key', {set: {a: 1, b: 1}})
		const expected1 = new Delta() // gonna get deleted
		const expected2 = new Delta() // no retain on a deleted object
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
	it('should transform delete + insert', function () {
		const a = new Delta().delete('a-key')
		const b = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		const expected1 = new Delta() // gonna get deleted
		const expected2 = new Delta().insert('a-key', {set: {a: 1, b: 1}})
		expect(a.transform(b)).to.equalDelta(expected1)
		expect(a.transform(b, true)).to.equalDelta(expected2)
	})
})
