// lifted from https://github.com/quilljs/delta/blob/master/lib/delta.js
import { getOpLength } from './utils'
import Iterator from './op-iterator'

export default class Delta {
	constructor (ops = []) {
		this.ops = ops
	}

	insert (text) {
		// TODO canonical op ordering
		const op = { insert: text }
		return this.push(op)
	}

	delete (length) {
		const op = { delete: length }
		return this.push(op)
	}

	retain (length) {
		const op = { retain: length }
		return this.push(op)
	}

	push (newOp) {
		const index = this.ops.length
		const lastOp = this.ops[index - 1]

		// patch lastOp if we can
		if (lastOp) {
			if (newOp.retain && lastOp.retain) {
				this.ops[index - 1] = { retain: lastOp.retain + newOp.retain }
				return this
			}

			if (newOp.insert && lastOp.insert) {
				this.ops[index - 1] = { insert: lastOp.insert + newOp.insert }
				return this
			}

			if (newOp.delete && lastOp.delete) {
				this.ops[index - 1] = { delete: lastOp.delete + newOp.delete }
				return this
			}
		}
		this.ops.push(newOp)
		return this
	}

	apply (source) {
		// TODO range checks
		const newString = []
		let sourceIndex = 0
		for (const op of this.ops) {
			if (op.retain) {
				newString.push(source.slice(sourceIndex, sourceIndex + op.retain))
				sourceIndex += op.retain
			} else if (op.insert) {
				newString.push(op.insert)
			} else if (op.delete) {
				sourceIndex += op.delete
			}
		}

		// retain the remaining string
		newString.push(source.slice(sourceIndex))

		return newString.join('')
	}

	chop () {
		const lastOp = this.ops[this.ops.length - 1]
		if (lastOp && lastOp.retain) {
			this.ops.pop()
		}
		return this
	}

	// Compose merges two consecutive operations into one operation, that
	// preserves the changes of both. Or, in other words, for each input string S
	// and a pair of consecutive operations A and B,
	// apply(apply(S, A), B) = apply(S, compose(A, B)) must hold.
	compose (otherDelta) {
		const thisIter = new Iterator(this.ops)
		const otherIter = new Iterator(otherDelta.ops)
		const newDelta = new Delta()

		while (thisIter.hasNext() || otherIter.hasNext()) {
			if (otherIter.peekType() === 'insert') { // new insert always gets used
				newDelta.push(otherIter.next())
			} else if (thisIter.peekType() === 'delete') { // old delete always gets used
				newDelta.push(thisIter.next())
			} else {
				const length = Math.min(thisIter.peekLength(), otherIter.peekLength())
				const thisOp = thisIter.next(length)
				const otherOp = otherIter.next(length)
				if (typeof otherOp.retain === 'number') {
					if (typeof thisOp.retain === 'number') { // if both retain, also retain
						newDelta.push({ retain: length })
					} else {
						newDelta.push({ insert: thisOp.insert }) // old insert overrides new retain
					}
				// new op should be delete, old op is either insert or retain
				// new delete and old insert cancel out, new delete overrides old remain
				} else if (typeof otherOp.delete === 'number' && typeof thisOp.retain === 'number') {
					newDelta.push(otherOp)
				}
			}
		}

		return newDelta.chop()
	}

	// Transform takes two operations A and B that happened concurrently and
	// produces two operations A' and B' (in an array) such that
	// `apply(apply(S, A), B') = apply(apply(S, B), A')`. This function is the
	// heart of OT.
	transform (otherDelta, hasPriority) {
		const thisIter = new Iterator(this.ops)
		const otherIter = new Iterator(otherDelta.ops)
		const newDelta = new Delta()

		while (thisIter.hasNext() || otherIter.hasNext()) {
			if (thisIter.peekType() === 'insert' && (hasPriority || otherIter.peekType() !== 'insert')) {
				newDelta.retain(getOpLength(thisIter.next()))
			} else if (otherIter.peekType() === 'insert') {
				newDelta.push(otherIter.next())
			} else {
				const length = Math.min(thisIter.peekLength(), otherIter.peekLength())
				const thisOp = thisIter.next(length)
				const otherOp = otherIter.next(length)
				if (thisOp.delete) {
					// Our delete either makes their delete redundant or removes their retain
					continue
				} else if (otherOp.delete) {
					newDelta.push(otherOp)
				} else {
					// We retain either their retain or insert
					newDelta.retain(length)
				}
			}
		}

		return newDelta.chop()
	}
}
