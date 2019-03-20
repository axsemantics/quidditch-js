/* global describe, before, it */

const chai = require('chai')
const expect = chai.expect
const { DeltaString } = require('../dist/quidditch.js')
chai.use(require('./delta-string-utils'))
// const SIMPLE_EMOJI = '🔥' // has length 1
// const RAINBOW_FLAG = '🏳️‍🌈' // has length 4 (yes, yes)

describe('DeltaString', () => {
	it('should construct', () => {
		new DeltaString('myString') // eslint-disable-line no-new
	})

	it('should equal native string', () => {
		const string = new DeltaString('my🔥String')
		expect(string == 'my🔥String') // eslint-disable-line eqeqeq
		expect(string).to.equalDelta('my🔥String')
		expect(string).to.equalDelta('my🔥String')
	})

	it('should have correct length', () => {
		const string = new DeltaString('a🔥c')
		expect(string.length).to.equal(3)
	})

	it('should iterate', () => {
		const string = new DeltaString('a🔥c')
		const iter = string[Symbol.iterator]()
		expect(iter.next().value).to.equal('a')
		expect(iter.next().value).to.equal('🔥')
		expect(iter.next().value).to.equal('c')
	})

	it('should concat', () => {
		const string1 = new DeltaString('a🔥c')
		const string2 = new DeltaString('d🦊f')
		const result = string1.concat(string2)
		// don't mutate old strings
		expect(string1.characterArray.length).to.equal(3)
		expect(string2.characterArray.length).to.equal(3)
		expect(result instanceof DeltaString)
		expect(result).to.equalDelta('a🔥cd🦊f')
		// TODO multiple arguments
	})

	it('should indexOf', () => {
		const string = new DeltaString('a🔥cd🦊f')
		expect(string.indexOf('🦊')).to.equal(4)
		expect(string.indexOf('d🦊f')).to.equal(3)
		// TODO indexOf with DeltaString
	})

	it('should slice', () => {
		const string = new DeltaString('fire🔥fox🦊unicorn🦄yay')

		expect(string.slice(5, 9)).to.equalDelta('fox🦊')
		// TODO negatives, inverted params
		expect(string.characterArray.length).to.equal(20)
	})

	it('should substring', () => {
		const string = new DeltaString('fire🔥fox🦊unicorn🦄yay')

		expect(string.substring(5, 9)).to.equalDelta('fox🦊')
		// TODO negatives, inverted params
		expect(string.characterArray.length).to.equal(20)
	})

	it('should substr', () => {
		const string = new DeltaString('fire🔥fox🦊unicorn🦄yay')

		expect(string.substr(5, 4)).to.equalDelta('fox🦊')
		expect(string.substr(0, 8)).to.equalDelta('fire🔥fox')
		// TODO negatives
		expect(string.characterArray.length).to.equal(20)
	})
})
