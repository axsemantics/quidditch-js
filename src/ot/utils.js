import cloneDeep from 'lodash/cloneDeep'
import cloneDeepWith from 'lodash/cloneDeepWith'
import isEqualWith from 'lodash/isEqualWith'

import DeltaString from './string'
import { SUBTYPES, BASE_TYPES } from './subtypes'

const deltaStringEqualCustomizer = function (a, b) {
	if (a instanceof DeltaString && b instanceof DeltaString) {
		return a.equals(b)
	}
	if (a instanceof DeltaString || b instanceof DeltaString) {
		return a == b // eslint-disable-line eqeqeq
	}
}

export function isEqual (a, b) {
	return isEqualWith(a, b, deltaStringEqualCustomizer)
}

const deltaStringCloneCustomizer = function (value) {
	if (value instanceof DeltaString) {
		return value.slice()
	}
}

export function clone (obj) {
	return cloneDeepWith(obj, deltaStringCloneCustomizer)
}

export function getOpLength (op) {
	if (typeof op['delete'] === 'number') {
		return op['delete']
	} else if (typeof op.retain === 'number') {
		return op.retain
	} else {
		return op.insert instanceof DeltaString ? op.insert.length : 1
	}
}

export function convertOps (ops) {
	const convertOp = function (op) {
		// convert strings to DeltaString
		if (typeof op.insert === 'string' && !op.$set) {
			op.insert = new DeltaString(op.insert)
			return op
		}

		if (op.$sub?.items) {
			convertOps(op.$sub.items)
			return op
		}

		if (op.$sub) {
			convertOps(op.$sub)
			return op
		}

		const typeSpec = SUBTYPES[op.insert?._t]
		if (typeSpec) {
			for (const [key, value] of Object.entries(op.insert)) {
				if (typeSpec[key] === BASE_TYPES.DELTA_STR && !(value instanceof DeltaString)) {
					op.insert[key] = new DeltaString(value)
				}
				if (typeSpec[key] === BASE_TYPES.DELTA) {
					convertOps(op.insert[key])
				}
			}
		}
	}

	if (!(ops instanceof Array)) {
		return convertOp(ops)
	}
	for (const op of ops) {
		convertOp(op)
	}
	return ops
}

const attributes = {
	compose (a, b, keepNull) {
		if (typeof a !== 'object') a = {}
		if (typeof b !== 'object') b = {}
		let attributes = cloneDeep(b)
		if (!keepNull) {
			attributes = Object.keys(attributes).reduce(function (copy, key) {
				if (attributes[key] != null) {
					copy[key] = attributes[key]
				}
				return copy
			}, {})
		}
		// TODO make deep?
		for (const key in a) {
			if (a[key] !== undefined && b[key] === undefined) {
				attributes[key] = a[key]
			}
		}
		return Object.keys(attributes).length > 0 ? attributes : undefined
	},

	diff (a, b) {
		if (typeof a !== 'object') a = {}
		if (typeof b !== 'object') b = {}
		var attributes = Object.keys(a).concat(Object.keys(b)).reduce(function (attributes, key) {
			if (!isEqual(a[key], b[key])) {
				attributes[key] = b[key] === undefined ? null : b[key]
			}
			return attributes
		}, {})
		return Object.keys(attributes).length > 0 ? attributes : undefined
	},

	transform: function (a, b, otherHappenedLater) {
		if (typeof a !== 'object') return b
		if (typeof b !== 'object') return undefined
		if (otherHappenedLater) return b // b simply overwrites us when it happened later
		var attributes = Object.keys(b).reduce(function (attributes, key) {
			if (a[key] === undefined) attributes[key] = b[key] // null is a valid value
			return attributes
		}, {})
		return Object.keys(attributes).length > 0 ? attributes : undefined
	}
}

export { attributes as attributeOperations }
