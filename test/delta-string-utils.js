const isEqualWith = require('lodash/isEqualWith')
const { DeltaString } = require('../dist/quidditch.js')

const deltaStringCustomizer = function (a, b) {
	if (a instanceof DeltaString || b instanceof DeltaString) {
		return a == b // eslint-disable-line eqeqeq
	}
}

module.exports.isEqual = function (a, b) {
	return isEqualWith(a, b, deltaStringCustomizer)
}
