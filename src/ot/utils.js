import equal from 'deep-equal'

export function getOpLength (op) {
	if (typeof op['delete'] === 'number') {
		return op['delete']
	} else if (typeof op.retain === 'number') {
		return op.retain
	} else {
		return typeof op.insert === 'string' ? op.insert.length : 1
	}
}

const attributes = {
	compose (a, b, keepNull) {
		if (typeof a !== 'object') a = {}
		if (typeof b !== 'object') b = {}
		// TODO is deep copy relevant?
		let attributes = Object.assign({}, b)
		if (!keepNull) {
			attributes = Object.keys(attributes).reduce(function (copy, key) {
				if (attributes[key] != null) {
					copy[key] = attributes[key]
				}
				return copy
			}, {})
		}
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
			if (!equal(a[key], b[key])) {
				attributes[key] = b[key] === undefined ? null : b[key]
			}
			return attributes
		}, {})
		return Object.keys(attributes).length > 0 ? attributes : undefined
	},

	transform: function (a, b, priority) {
		if (typeof a !== 'object') return b
		if (typeof b !== 'object') return undefined
		if (!priority) return b // b simply overwrites us without priority
		var attributes = Object.keys(b).reduce(function (attributes, key) {
			if (a[key] === undefined) attributes[key] = b[key] // null is a valid value
			return attributes
		}, {})
		return Object.keys(attributes).length > 0 ? attributes : undefined
	}
}

export { attributes as attributeOperations }
