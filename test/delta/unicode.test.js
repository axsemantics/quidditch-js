/* global describe, before, it */

const chai = require('chai')
const sinonChai = require('sinon-chai')
const expect = chai.expect
chai.use(sinonChai)

const { Delta, DeltaString } = require('../../dist/quidditch.js')

const SIMPLE_EMOJI = '🔥' // has length 1
const RAINBOW_FLAG = '🏳️‍🌈' // has length 4 (yes, yes)

describe('Emoji', () => {
	it('should compose simple emoji lengths', () => {
		const delta1 = new Delta().insert(SIMPLE_EMOJI)
		const delta2 = new Delta().delete(1)

		expect(delta1.compose(delta2).ops.length).to.equal(0)
	})
})

describe('DeltaString', () => {
	it('should convert all plain strings to DeltaString', () => {
		const delta = new Delta([
			{
				insert: 'foo'
			}, {
				insert: {
					_t: 'switch',
					items: [{
						insert: 'bar'
					}]
				}
			}, {
				retain: 1,
				$sub: {
					items: [{
						insert: 'zoom'
					}]
				}
			}
		])
		expect(delta.ops[0].insert).to.be.an.instanceof(DeltaString)
		expect(delta.ops[1].insert.items[0].insert).to.be.an.instanceof(DeltaString)
		expect(delta.ops[2].$sub.items[0].insert).to.be.an.instanceof(DeltaString)
	})

	it('should convert all plain strings to DeltaString with retains', () => {
		const delta = new Delta([
			{
				retain: 3
			}, {
				retain: 1,
				$sub: [{
					retain: 2
				}, {
					retain: 1,
					$sub: [{
						retain: 7
					}, {
						insert: 'bar'
					}]
				}]
			}
		])
		expect(delta.ops[1].$sub[1].$sub[1].insert).to.be.an.instanceof(DeltaString)
	})
})
