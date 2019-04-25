/* global describe, it */

const chai = require('chai')
const expect = chai.expect
chai.use(require('../delta-string-utils'))

const { Delta } = require('../../dist/quidditch.js')
const fixtures = require('./fixtures')

describe('Delta.compose()', () => {
	it('should compose insert + insert', function () {
		const a = new Delta().insert('A')
		const b = new Delta().insert('B')
		const expected = new Delta().insert('BA')
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose insert + retain', function () {
		const a = new Delta().insert('A')
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red', font: null }})
		const expected = new Delta().insert('A', { bold: true, color: 'red' })
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose insert + delete', function () {
		const a = new Delta().insert('A')
		const b = new Delta().delete(1)
		const expected = new Delta()
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose delete + insert', function () {
		const a = new Delta().delete(1)
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B').delete(1)
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose delete + retain', function () {
		const a = new Delta().delete(1)
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red' }})
		const expected = new Delta().delete(1).retain(1, {attributes: { bold: true, color: 'red' }})
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose delete + delete', function () {
		const a = new Delta().delete(1)
		const b = new Delta().delete(1)
		const expected = new Delta().delete(2)
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + insert', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().insert('B')
		const expected = new Delta().insert('B').retain(1, {attributes: { color: 'blue' }})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose retain + retain', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().retain(1, {attributes: { bold: true, color: 'red', font: null }})
		const expected = new Delta().retain(1, {attributes: { bold: true, color: 'red', font: null }})
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose retain + delete', function () {
		const a = new Delta().retain(1, {attributes: { color: 'blue' }})
		const b = new Delta().delete(1)
		const expected = new Delta().delete(1)
		expect(a.compose(b)).to.deep.equal(expected)
	})

	it('should compose insert in middle of text', function () {
		const a = new Delta().insert('Hello')
		const b = new Delta().retain(3).insert('X')
		const expected = new Delta().insert('HelXlo')
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose insert and delete ordering', function () {
		const a = new Delta().insert('Hello')
		const b = new Delta().insert('Hello')
		const insertFirst = new Delta().retain(3).insert('X').delete(1)
		const deleteFirst = new Delta().retain(3).delete(1).insert('X')
		const expected = new Delta().insert('HelXo')
		expect(a.compose(insertFirst)).to.equalDelta(expected)
		expect(b.compose(deleteFirst)).to.equalDelta(expected)
	})

	it('should compose delete entire text', function () {
		const a = new Delta().retain(4).insert('Hello')
		const b = new Delta().delete(9)
		const expected = new Delta().delete(4)
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should retain more than length of text', function () {
		const a = new Delta().insert('Hello')
		const b = new Delta().retain(10)
		const expected = new Delta().insert('Hello')
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should remove all attributes', function () {
		const a = new Delta().insert('A', { bold: true })
		const b = new Delta().retain(1, {attributes: { bold: null }})
		const expected = new Delta().insert('A')
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('shoulb be immutable', function () {
		const attr1 = { bold: true }
		const attr2 = { bold: true }
		const a1 = new Delta().insert('Test', attr1)
		const a2 = new Delta().insert('Test', attr1)
		const b1 = new Delta().retain(1, {attributes: { color: 'red' }}).delete(2)
		const b2 = new Delta().retain(1, {attributes: { color: 'red' }}).delete(2)
		const expected = new Delta().insert('T', { color: 'red', bold: true }).insert('t', attr1)
		expect(a1.compose(b1)).to.equalDelta(expected)
		expect(a1).to.equalDelta(a2)
		expect(b1).to.equalDelta(b2)
		expect(attr1).to.equalDelta(attr2)
	})

	it('should compose between objects', function () {
		const a = new Delta(fixtures.flatObjectsOps())
		const b = new Delta().retain(4).insert({_t: 'random'})
		const expected = [{insert: 'abc'}, {insert: {_t: 'container'}}, {insert: {_t: 'random'}}, {insert: {_t: 'case'}}, {insert: 'def'}]
		expect(a.compose(b).ops).to.equalDelta(expected)
	})

	it('should compose objects deletion', function () {
		const a = new Delta(fixtures.flatObjectsOps())
		const b = new Delta().retain(2).delete(4)
		const expected = [{'insert': 'abef'}]
		expect(a.compose(b).ops).to.equalDelta(expected)
	})

	it('should compose subOps and set', function () {
		const a = new Delta(fixtures.flatObjectsOps())
		const b1 = new Delta().retain(3).retain(1, {set: {container_type: 'foo'}, subOps: {text: new Delta().insert('bla').ops}})
		const b2 = new Delta().retain(4).retain(1, {subOps: new Delta().insert('bar').ops})
		const expected = [{insert: 'abc'}, {insert: {_t: 'container', container_type: 'foo', text: 'bla'}}, {insert: {_t: 'case', items: [{insert: 'bar'}]}}, {insert: 'def'}]
		const b = b1.compose(b2)
		expect(b.ops.length).to.equal(3)
		expect(a.compose(b).ops).to.equalDelta(expected)
	})

	it('should compose non-document subOps and set', function () {
		const a = new Delta().delete(4).retain(1, {set: {id: 'abc'}})
		const b = new Delta().retain(1, {set: {container_type: 'foo'}, subOps: {text: new Delta().insert('bar').ops}})
		const expected = [{delete: 4}, {retain: 1, $set: {container_type: 'foo', id: 'abc'}, $sub: {text: [{insert: 'bar'}]}}]
		expect(a.compose(b).ops).to.equalDelta(expected)
	})

	it('should compose subOps with abbreviated retain', function () {
		const a = new Delta().retain(1, {subOps: [{insert: 'foo'}]})
		const b = new Delta().retain(1, {subOps: {text: new Delta().insert('bar').ops}})
		const expected1 = [{retain: 1, $sub: {items: [{insert: 'foo'}], text: [{insert: 'bar'}]}}]
		const expected2 = [{retain: 1, $sub: [{insert: 'foofoo'}]}]
		expect(a.compose(b).ops).to.equalDelta(expected1)
		expect(a.compose(a).ops).to.equalDelta(expected2)
	})

	// it('should compose subOps with abbreviated insert', function () {
	// 	const a = new Delta().insert(1, {subOps: [{insert: 'foo'}]})
	// 	const b = new Delta().retain(1, {subOps: {text: new Delta().insert('bar').ops}})
	// 	const expected = [{'insert': {'_t': 'container', 'items': [{'insert': 'foo'}], 'text': [{'insert': 'bar'}]}}]
	// 	expect(a.compose(b)).ops.to.deep.equal(expected)
	// })

	it('should compose unset', function () {
		const flat = fixtures.flatObjectsOps()
		flat[1].insert.container_type = 'bar'
		const a = new Delta(flat)
		const b = new Delta().retain(3).retain(1, {set: {container_type: null, id: null}})
		const expected = [{insert: 'abc'}, {insert: {_t: 'container'}}, {insert: {_t: 'case'}}, {insert: 'def'}]
		expect(a.compose(b).ops).to.equalDelta(expected)
	})

	it('should compose $sub with state 1', function () {
		const a = new Delta(fixtures.deltaState())
		const b = new Delta().retain(2).retain(1, {subOps: [fixtures.opRetainA(), fixtures.opRetainB()]})
		const expected = new Delta().insert('ab').insert({
			_t: 'random',
			items: [{
				insert: {
					_t: 'switch',
					items: [{
						insert: {
							_t: 'case',
							condition: '3 > 2',
							items: [{
								insert: {
									_t: 'container',
									container_type: 'grammar',
									attributes: {gender: 'f'},
									text: 'a'
								}
							}]
						}
					}]
				}
			}, {
				insert: {
					_t: 'container',
					text: 'b'
				}
			}]
		})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose $sub with state 2', function () {
		const a = new Delta(fixtures.deltaState())
		const b = new Delta().retain(2).retain(1, {subOps: [fixtures.opRetainA()]})
		const expected = new Delta().insert('ab').insert({
			_t: 'random',
			items: [{
				insert: {
					_t: 'switch',
					items: [{
						insert: {
							_t: 'case',
							condition: '3 > 2',
							items: [{
								insert: {
									_t: 'container',
									container_type: 'grammar',
									attributes: {gender: 'f'},
									text: 'a'
								}
							}]
						}
					}]
				}
			}, {
				insert: {
					_t: 'container',
					text: ''
				}
			}]
		})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose $sub with state 3', function () {
		const a = new Delta(fixtures.deltaState())
		const b = new Delta().retain(2).retain(1, {subOps: [{retain: 1}, fixtures.opRetainB()]})
		const expected = new Delta().insert('ab').insert({
			_t: 'random',
			items: [{
				insert: {
					_t: 'switch',
					items: [{
						insert: {
							_t: 'case',
							condition: '3 > 2',
							items: [{
								insert: {
									_t: 'container',
									text: ''
								}
							}]
						}
					}]
				}
			}, {
				insert: {
					_t: 'container',
					text: 'b'
				}
			}]
		})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	it('should compose deep $sub', function () {
		const a = new Delta().retain(2).retain(1, {subOps: [fixtures.opRetainA()]})
		const b = new Delta().retain(2).retain(1, {subOps: [{retain: 1}, fixtures.opRetainB()]})
		const expected = new Delta().retain(2).retain(1, {subOps: [fixtures.opRetainA(), fixtures.opRetainB()]})
		expect(a.compose(b)).to.equalDelta(expected)
	})

	// do we need type checks in the frontend?
	// [
	// 	[{insert: null}, 'must be string or object'],
	// 	[{insert: {}}, 'must contain a type mark'],
	// 	[{insert: {_t: 'foo'}}, 'invalid item type'],
	// 	[{insert: {_t: 'container', foo: 'bar'}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}}, ''],
	// 	[{insert: {}} , ''],
	// 	[{insert: {}}, ''],
	// ].forEach(function (test) {
	// 	it('should not compose: ' + test[1], function () {
	// 		const a = fixtures.deltaState()
	// 		const b = new Delta().retain(2).retain(1, {subOps: [test[0]]})
	// 		expect(function () { a.compose(b) }).to.throw(TypeError, test[1])
	// 	})
	// })
})
