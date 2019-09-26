// lifted from https://github.com/quilljs/delta/blob/master/lib/op.js
import { getOpLength } from './utils'
import DeltaString from './string'

export default class OpIterator {
	constructor (ops) {
		this.ops = ops
		this.index = 0
		this.offset = 0
	}

	// override for custom behaviour
	getOpLength (op) {
		return getOpLength(op)
	}

	copyInsert (op, offset, length) {
		if (op.insert instanceof DeltaString) {
			return op.insert.substr(offset, length)
		}
		if (typeof op.insert === 'object' || (typeof op.insert === 'string' && op.$set)) {
			return op.insert
		}
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
		const opLength = this.getOpLength(nextOp)
		if (length >= opLength - offset) {
			length = opLength - offset
			this.index++
			this.offset = 0
		} else {
			this.offset += length
		}
		if (typeof nextOp.delete === 'number') {
			return { delete: length }
		} else {
			const retOp = {}
			if (nextOp.attributes) {
				retOp.attributes = nextOp.attributes
			}
			if (nextOp.$set) {
				retOp.$set = nextOp.$set
			}
			if (typeof nextOp.retain === 'number') {
				retOp.retain = length
				if (nextOp.$sub) {
					retOp.$sub = nextOp.$sub
				}
			}
			if (nextOp.insert) {
				retOp.insert = this.copyInsert(nextOp, offset, length)
			}
			return retOp
		}
	}

	peek () {
		return this.ops[this.index]
	}

	peekLength () {
		if (this.ops[this.index]) {
			return this.getOpLength(this.ops[this.index]) - this.offset
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
