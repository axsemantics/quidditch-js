/* global describe, it */
const { Delta, applyOpsToState } = require('../../dist/quidditch.js')
const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))

describe('delta applyOpsToState', function () {
	it('should insert into empty state', function () {
		const state = new Delta()
		const delta = new Delta().insert('ABC')
		const expected = new Delta().insert('ABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply insert', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().insert('DEF')
		const expected = new Delta().insert('DEFABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply retain, insert', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().retain(3).insert('DEF')
		const expected = new Delta().insert('ABCDEF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply retain, insert in middle', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().retain(1).insert('D').retain(1).insert('E').retain(1).insert('F')
		const expected = new Delta().insert('ADBECF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply complex insert', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().retain(3).insert({_t: 'container', text: 'DEF'})
		const expected = new Delta().insert('ABC').insert({_t: 'container', text: 'DEF'})

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply complex insert at start', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().insert({_t: 'container', text: 'DEF'})
		const expected = new Delta().insert({_t: 'container', text: 'DEF'}).insert('ABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply delete', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().delete(2)
		const expected = new Delta().insert('C')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply complete delete', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().delete(3)
		const expected = new Delta()

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply retain, delete', function () {
		const state = new Delta().insert('ABC')
		const delta = new Delta().retain(1).delete(1)
		const expected = new Delta().insert('AC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply complex delete', function () {
		const state = new Delta().insert('ABC').insert({_t: 'container', text: 'DEF'}).insert('ABC')
		const delta = new Delta().retain(2).delete(3)
		const expected = new Delta().insert('ABBC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply insert, delete and merge string', function () {
		const state = new Delta().insert({_t: 'container', text: 'ABC'})
		const delta = new Delta().insert('ABC').delete(1)
		const expected = new Delta().insert('ABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply $sub', function () {
		const state = new Delta().insert('ABC').insert({_t: 'switch', items: [{insert: {_t: 'case', items: [{insert: 'DERP'}]}}]}).insert('ABC')
		const delta = new Delta().retain(3).retain(1, {subOps: new Delta().retain(1).insert({_t: 'case', items: [{insert: 'FOO'}]}).ops})
		const expected = new Delta().insert('ABC').insert({_t: 'switch', items: [{insert: {_t: 'case', items: [{insert: 'DERP'}]}}, {insert: {_t: 'case', items: [{insert: 'FOO'}]}}]}).insert('ABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply $sub to text', function () {
		const state = new Delta().insert('ABC').insert({_t: 'container', text: 'derp'}).insert('ABC')
		const delta = new Delta().retain(3).retain(1, {subOps: {text: new Delta().delete(4).insert('foo').ops}})
		const expected = new Delta().insert('ABC').insert({_t: 'container', text: 'foo'}).insert('ABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply $set', function () {
		const state = new Delta().insert('ABC').insert({_t: 'container', text: 'foo'}).insert('ABC')
		const delta = new Delta().retain(3).retain(1, {set: {attributes: {thing: 'thing'}}})
		const expected = new Delta().insert('ABC').insert({_t: 'container', text: 'foo', attributes: {thing: 'thing'}}).insert('ABC')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should create container from text', function () {
		const state = new Delta().insert('ABCDEF')
		const delta = new Delta().retain(2).delete(2).insert({_t: 'container', text: 'CD'})
		const expected = new Delta().insert('AB').insert({_t: 'container', text: 'CD'}).insert('EF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should create switch from text+containers', function () {
		const state = new Delta().insert('AB').insert({_t: 'container', text: 'CD'}).insert('EF')
		const delta = new Delta().retain(1).delete(3).insert({_t: 'switch', items: [{insert: {_t: 'case', items: [{insert: 'B'}, {insert: {_t: 'container', text: 'CD'}}, {insert: 'E'}]}}]})
		const expected = new Delta().insert('A').insert({_t: 'switch', items: [{insert: {_t: 'case', items: [{insert: 'B'}, {insert: {_t: 'container', text: 'CD'}}, {insert: 'E'}]}}]}).insert('F')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply attributes', function () {
		const state = new Delta().insert('ABCDEF')
		const delta = new Delta().retain(2).retain(2, {attributes: {head: true}})
		const expected = new Delta().insert('AB').insert('CD', {attributes: {head: true}}).insert('EF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply attributes on start', function () {
		const state = new Delta().insert('ABCDEF')
		const delta = new Delta().retain(2, {attributes: {head: true}})
		const expected = new Delta().insert('AB', {attributes: {head: true}}).insert('CDEF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply attributes on end', function () {
		const state = new Delta().insert('ABCDEF')
		const delta = new Delta().retain(4).retain(2, {attributes: {head: true}})
		const expected = new Delta().insert('ABCD').insert('EF', {attributes: {head: true}})

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply attributes to containers', function () {
		const state = new Delta().insert('AB').insert({_t: 'container', text: 'CD'}).insert('EF')
		const delta = new Delta().retain(2).retain(1, {attributes: {head: true}})
		const expected = new Delta().insert('AB').insert({_t: 'container', text: 'CD'}, {attributes: {head: true}}).insert('EF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should apply attributes over containers', function () {
		const state = new Delta().insert('AB').insert({_t: 'container', text: 'CD'}).insert('EF')
		const delta = new Delta().retain(1).retain(3, {attributes: {head: true}})
		const expected = new Delta().insert('A').insert('B', {attributes: {head: true}}).insert({_t: 'container', text: 'CD'}, {attributes: {head: true}}).insert('E', {attributes: {head: true}}).insert('F')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should merge same attributes from previous', function () {
		const state = new Delta().insert('ABCD', {attributes: {head: true}}).insert('EF')
		const delta = new Delta().retain(4).retain(1, {attributes: {head: true}})
		const expected = new Delta().insert('ABCDE', {attributes: {head: true}}).insert('F')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should merge same attributes from next', function () {
		const state = new Delta().insert('ABCD').insert('EF', {attributes: {head: true}})
		const delta = new Delta().retain(3).retain(1, {attributes: {head: true}})
		const expected = new Delta().insert('ABC').insert('DEF', {attributes: {head: true}})

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should remove attributes', function () {
		const state = new Delta().insert('ABCD').insert('EF', {attributes: {head: true}})
		const delta = new Delta().retain(4).retain(1, {attributes: {head: null}})
		const expected = new Delta().insert('ABCDE').insert('F', {attributes: {head: true}})

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should remove attributes and merge', function () {
		const state = new Delta().insert('ABCD').insert('EF', {attributes: {head: true}})
		const delta = new Delta().retain(4).retain(2, {attributes: {head: null}})
		const expected = new Delta().insert('ABCDEF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should remove attributes and merge back', function () {
		const state = new Delta().insert('ABCD', {attributes: {head: true}}).insert('EF')
		const delta = new Delta().retain(4, {attributes: {head: null}})
		const expected = new Delta().insert('ABCDEF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should accept overlapping changed attributes', function () {
		const state = new Delta().insert('ABCD', {attributes: {head: true}}).insert('EF')
		const delta = new Delta().retain(6, {attributes: {head: null}})
		const expected = new Delta().insert('ABCDEF')

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should not merge with different attributes', function () {
		const state = new Delta().insert('ABCD').insert('EF', {attributes: {head: true}})
		const delta = new Delta().retain(3).delete(1)
		const expected = new Delta().insert('ABC').insert('EF', {attributes: {head: true}})

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should not merge with different attributes when deleting container', function () {
		const state = new Delta().insert('ABCD').insert({_t: 'container', text: 'CD'}, {attributes: {head: true}}).insert('EF', {attributes: {head: true}})
		const delta = new Delta().retain(4).delete(1)
		const expected = new Delta().insert('ABCD').insert('EF', {attributes: {head: true}})

		applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
	})

	it('should track and return added and removed containers', function () {
		const state = new Delta()
			.insert('ABCD')
			.insert({_t: 'container', id: 1, text: 'CD'})
			.insert('EF')
			.insert({_t: 'container', id: 2, text: 'G'})
			.insert('HIJ')
			.insert({_t: 'container', id: 3, text: 'KL'})
			.insert('MN')
			.insert({
				_t: 'switch',
				items: [{
					insert: {
						_t: 'case',
						items: new Delta().insert('OPQ').ops
					}
				}]
			})
		const delta = new Delta()
			.retain(1)
			.delete(2)
			.insert({_t: 'container', id: 4, text: 'BC'})
			.retain(1)
			.delete(1)
			.retain(1)
			.delete(3)
			.insert({
				_t: 'switch',
				items: [{
					insert: {
						_t: 'case',
						items: new Delta().insert('F').insert({_t: 'container', id: 5, text: 'G'}).insert('H').ops
					}
				}]
			})
			.retain(5)
			.retain(1, {subOps: [{retain: 1, $sub: new Delta().retain(1).delete(1).insert({_t: 'container', id: 6, text: 'P'}).ops}]})

		const trackedObjects = applyOpsToState(state.ops, delta.ops)
		expect(trackedObjects.container.added).to.equalDelta([
			{_t: 'container', id: 4, text: 'BC'},
			{_t: 'container', id: 5, text: 'G'},
			{_t: 'container', id: 6, text: 'P'}
		])
		expect(trackedObjects.container.removed).to.equalDelta([
			{_t: 'container', id: 1, text: 'CD'},
			{_t: 'container', id: 2, text: 'G'}
		])
	})

	it('should apply map changes to a plain map', function () {
		const state = new Delta().insert({
			_t: 'mapParent',
			items: {
				'a-key': {_id: 'a-key', _t: 'mapItem', a: 1},
				'c-key': {_id: 'c-key', _t: 'mapItem', itemDelta: new Delta().insert('A').ops},
				'd-key': {_id: 'd-key', _t: 'mapItem', d: 1}
			}
		})

		const delta = new Delta().retain(1, {subOps: {items: new Delta()
			.insert('b-key', {set: {_t: 'mapItem', b: 1}})
			.retain('a-key', {set: {b: 2}})
			.retain('c-key', {subOps: {itemDelta: new Delta().retain(1).insert('B').ops}})
			.delete('d-key')
			.ops}})
		const expected = new Delta().insert({
			_t: 'mapParent',
			items: {
				'a-key': {_id: 'a-key', _t: 'mapItem', a: 1, b: 2},
				'b-key': {_id: 'b-key', _t: 'mapItem', b: 1},
				'c-key': {_id: 'c-key', _t: 'mapItem', itemDelta: new Delta().insert('AB').ops}
			}
		})

		const trackedObjects = applyOpsToState(state.ops, delta.ops)
		expect(state.ops).to.equalDelta(expected.ops)
		expect(trackedObjects).to.equalDelta({
			mapItem: {
				added: [{_id: 'b-key', _t: 'mapItem', b: 1}],
				removed: [{_id: 'd-key', _t: 'mapItem', d: 1}]
			}
		})
	})
})
