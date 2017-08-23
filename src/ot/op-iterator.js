// lifted from https://github.com/quilljs/delta/blob/master/lib/op.js

const getOpLength = function (op) {
	if (typeof op['delete'] === 'number') {
		return op['delete']
	} else if (typeof op.retain === 'number') {
		return op.retain
	} else {
		return typeof op.insert === 'string' ? op.insert.length : 1
	}
}

export default class OpIterator {
	constructor (ops) {
		this.ops = ops
		this.index = 0
		this.offset = 0
	}

	hasNext () {
		return this.peekLength() < Infinity
	}

	next (length) {
		if (!length) length = Infinity
		const nextOp = this.ops[this.index]
		if (!nextOp) {
			return { retain: Infinity }
		}

		const offset = this.offset
		const opLength = getOpLength(nextOp)
		if (length >= opLength - offset) {
			length = opLength - offset
			this.index++
			this.offset = 0
		} else {
			this.offset += length
		}
		if (typeof nextOp.delete === 'number') {
			return { delete: length }
		}
		if (typeof nextOp.retain === 'number') {
			return { retain: length }
		}
		if (typeof nextOp.insert === 'string') {
			return { insert: nextOp.insert.substr(offset, length) }
		}
	}

	peek () {
		return this.ops[this.index]
	}

	peekLength () {
		if (this.ops[this.index]) {
			return getOpLength(this.ops[this.index]) - this.offset
		}
		return Infinity
	}

	peekType () {
		if (this.ops[this.index]) {
			if (typeof this.ops[this.index]['delete'] === 'number') {
				return 'delete'
			} else if (typeof this.ops[this.index].retain === 'number') {
				return 'retain'
			} else {
				return 'insert'
			}
		}
		return 'retain'
	}
}
