const isEqualWith = require('lodash/isEqualWith')
const { DeltaString } = require('../dist/quidditch.js')

const deltaStringCustomizer = function (a, b) {
	if (a instanceof DeltaString || b instanceof DeltaString) {
		return a.toString() === b.toString()
	}
}

module.exports = function (chai, utils) {
	const Assertion = chai.Assertion
	Assertion.addMethod('equalDelta', function (expected) {
		var obj = this._obj

		// second, our type check
		this.assert(
			isEqualWith(obj, expected, deltaStringCustomizer)
			, 'expected #{this} to equal #{exp} but got #{act}'
			, 'expected #{this} to equal #{exp} but got #{act}'
			, JSON.stringify(expected) // expected
			, JSON.stringify(obj) // actual
		)
	})
}
