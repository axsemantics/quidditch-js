/* global describe, before, it */

const chai = require('chai')
const sinonChai = require('sinon-chai')
const expect = chai.expect
chai.use(sinonChai)

const { Delta } = require('../../dist/quidditch.js')

const SIMPLE_EMOJI = '🔥' // has length 1
const RAINBOW_FLAG = '🏳️‍🌈' // has length 4 (yes, yes)

describe('Emoji', () => {
	it('should compose simple emoji lengths', () => {
		const delta1 = new Delta().insert(SIMPLE_EMOJI)
		const delta2 = new Delta().delete(1)

		expect(delta1.compose(delta2).ops.length).to.equal(0)
	})
})
