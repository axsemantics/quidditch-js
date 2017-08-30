export function getOpLength (op) {
	if (typeof op['delete'] === 'number') {
		return op['delete']
	} else if (typeof op.retain === 'number') {
		return op.retain
	} else {
		return typeof op.insert === 'string' ? op.insert.length : 1
	}
}
