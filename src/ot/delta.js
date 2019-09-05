// lifted from https://github.com/quilljs/delta/blob/master/lib/delta.js
import diff from 'fast-diff'
import { getOpLength, attributeOperations, convertOps, isEqual, clone } from './utils'
import Iterator from './op-iterator'
import DeltaString from './string'
import { SUBTYPES, BASE_TYPES } from './subtypes'

const NULL_CHARACTER = String.fromCharCode(0) // Placeholder char for embed in diff()

const composeOplist = function (a, b) {
	if (a && b) {
		return new Delta(a).compose(new Delta(b)).ops
	} else if (a) {
		return clone(a)
	} else if (b) {
		return clone(b)
	}
}

export default class Delta {
	constructor (ops = []) {
		convertOps(ops)
		this.ops = ops
	}

	insert (text, attributes) {
		// TODO canonical op ordering
		if (text.length === 0) return this
		const op = { insert: text }
		if (attributes != null && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
			op.attributes = attributes
		}
		return this.push(op)
	}

	delete (length) {
		if (length <= 0) return this
		const op = { delete: length }
		return this.push(op)
	}

	retain (length, args) {
		const {attributes, subOps, set} = args ?? {}
		if (length <= 0) return this
		const op = { retain: length }
		if (attributes != null && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
			op.attributes = attributes
		}
		if (set != null && typeof set === 'object' && Object.keys(set).length > 0) {
			op.$set = set
		}
		// subOps can be Delta, object, or array
		if (subOps != null && (typeof subOps === 'object' && Object.keys(subOps).length > 0)) {
			if (subOps instanceof Delta) {
				op.$sub = subOps.ops
			} else {
				op.$sub = subOps
			}
		}
		return this.push(op)
	}

	push (newOp) {
		let index = this.ops.length
		let lastOp = this.ops[index - 1]
		convertOps(newOp)
		// patch lastOp if we can
		if (typeof lastOp === 'object') {
			if (newOp.delete && lastOp.delete) {
				this.ops[index - 1] = { delete: lastOp.delete + newOp.delete }
				return this
			}

			// Since it does not matter if we insert before or after deleting at the same index,
			// always prefer to insert first
			if (typeof lastOp['delete'] === 'number' && newOp.insert != null) {
				index -= 1
				lastOp = this.ops[index - 1]
				if (!lastOp) {
					this.ops.unshift(newOp)
					return this
				}
			}

			if (isEqual(newOp.attributes, lastOp.attributes)) {
				if (newOp.insert instanceof DeltaString && lastOp.insert instanceof DeltaString) {
					this.ops[index - 1] = { insert: lastOp.insert.concat(newOp.insert) }
					if (newOp.attributes) this.ops[index - 1].attributes = newOp.attributes
					return this
				}

				if (typeof newOp.retain === 'number' && typeof lastOp.retain === 'number' &&
					isEqual(newOp.$sub, lastOp.$sub) &&
					isEqual(newOp.$set, lastOp.$set)
				) {
					this.ops[index - 1] = { retain: lastOp.retain + newOp.retain }
					if (newOp.attributes) this.ops[index - 1].attributes = newOp.attributes
					if (newOp.$sub) this.ops[index - 1].$sub = newOp.$sub
					if (newOp.$set) this.ops[index - 1].$set = newOp.$set
					return this
				}
			}
		}
		if (index === this.ops.length) {
			this.ops.push(newOp)
		} else {
			this.ops.splice(index, 0, newOp)
		}
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
		if (lastOp && lastOp.retain && !lastOp.attributes && !lastOp.$sub && !lastOp.$set) {
			this.ops.pop()
		}
		return this
	}

	map (predicate) {
		return this.ops.map(predicate)
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
					const newOp = {}
					if (typeof thisOp.retain === 'number') { // if both retain, also retain
						newOp.retain = length
						if (thisOp.$set || otherOp.$set) {
							newOp.$set = attributeOperations.compose(thisOp.$set, otherOp.$set, true)
						}
						if (thisOp.$sub && otherOp.$sub) {
							const thisSubs = thisOp.$sub instanceof Array ? {items: thisOp.$sub} : thisOp.$sub || {}
							const otherSubs = otherOp.$sub instanceof Array ? {items: otherOp.$sub} : otherOp.$sub || {}
							const newSubs = Object.assign({}, thisSubs)
							for (const [key, value] of Object.entries(otherSubs)) {
								newSubs[key] = composeOplist(thisSubs[key], value)
							}
							newOp.$sub = newSubs.items && Object.keys(newSubs).length === 1 ? newSubs.items : newSubs
						} else if (thisOp.$sub || otherOp.$sub) {
							newOp.$sub = composeOplist(thisOp.$sub, otherOp.$sub)
						}
						if (newOp.$sub && !Object.keys(newOp.$sub).length) {
							delete newOp.$sub
						}
					} else {
						if (thisOp.insert instanceof DeltaString || (!otherOp.$sub && !otherOp.$set)) {
							newOp.insert = thisOp.insert // old insert overrides new retain
						} else {
							const typeMark = thisOp.insert._t
							if (!SUBTYPES[typeMark]) throw new TypeError(`Invalid item type ${typeMark}`)
							const typeSpec = SUBTYPES[typeMark]
							// TODO typechecking
							newOp.insert = attributeOperations.compose(thisOp.insert, otherOp.$set, false)
							if (otherOp.$sub) {
								const otherSubs = otherOp.$sub instanceof Array ? {items: otherOp.$sub} : otherOp.$sub || {}
								for (const [key, value] of Object.entries(otherSubs)) {
									if (typeSpec[key] === BASE_TYPES.DELTA_STR) {
										newOp.insert[key] = new DeltaString(new Delta(value).apply(thisOp.insert[key] || ''))
									} else if (typeSpec[key] === BASE_TYPES.DELTA) {
										newOp.insert[key] = composeOplist(thisOp.insert[key], value)
									} else {
										throw new TypeError(` ${typeMark}.${key} is not a delta`)
									}
								}
							}
						}
					}
					// Preserve null when composing with a retain, otherwise remove it for inserts
					const attributes = attributeOperations.compose(thisOp.attributes, otherOp.attributes, typeof thisOp.retain === 'number')
					if (attributes) {
						newOp.attributes = attributes
					}
					newDelta.push(newOp)
				// new op should be delete, old op is either insert or retain
				// new delete and old insert cancel out, new delete overrides old remain
				} else if (typeof otherOp.delete === 'number' && typeof thisOp.retain === 'number') {
					newDelta.push(otherOp)
				}
			}
		}

		return newDelta.chop()
	}

	diff (otherDelta, index) {
		if (this.ops === otherDelta.ops) {
			return new Delta()
		}
		const strings = [this, otherDelta].map(function (delta) {
			return delta.map(function (op) {
				if (op.insert != null) {
					return op.insert instanceof DeltaString ? op.insert.toString() : NULL_CHARACTER
				}
				const prep = (delta === otherDelta) ? 'on' : 'with'
				throw new Error('diff() called ' + prep + ' non-document')
			}).join('')
		})
		const newDelta = new Delta()
		const diffResult = diff(strings[0], strings[1], index)
		const thisIter = new Iterator(this.ops)
		const otherIter = new Iterator(otherDelta.ops)
		diffResult.forEach(function (component) {
			let length = component[1].length
			while (length > 0) {
				let opLength = 0
				switch (component[0]) {
					case diff.INSERT:
						opLength = Math.min(otherIter.peekLength(), length)
						newDelta.push(otherIter.next(opLength))
						break
					case diff.DELETE:
						opLength = Math.min(length, thisIter.peekLength())
						thisIter.next(opLength)
						newDelta['delete'](opLength)
						break
					case diff.EQUAL:
						opLength = Math.min(thisIter.peekLength(), otherIter.peekLength(), length)
						const thisOp = thisIter.next(opLength)
						const otherOp = otherIter.next(opLength)
						if (isEqual(thisOp.insert, otherOp.insert)) {
							newDelta.retain(opLength, {attributes: attributeOperations.diff(thisOp.attributes, otherOp.attributes)})
						} else {
							newDelta.push(otherOp)['delete'](opLength)
						}
						break
				}
				length -= opLength
			}
		})
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
					let newSubs
					if (thisOp.$sub && otherOp.$sub) {
						const thisSubs = thisOp.$sub instanceof Array ? {items: thisOp.$sub} : thisOp.$sub || {}
						const otherSubs = otherOp.$sub instanceof Array ? {items: otherOp.$sub} : otherOp.$sub || {}
						newSubs = {}
						for (const [key, value] of Object.entries(otherSubs)) {
							if (thisSubs[key]) {
								newSubs[key] = new Delta(thisSubs[key]).transform(new Delta(value), hasPriority).ops
							} else {
								newSubs[key] = clone(value)
							}
						}
						newSubs = newSubs.items && Object.keys(newSubs).length === 1 ? newSubs.items : newSubs
					} else if (otherOp.$sub) {
						newSubs = clone(otherOp.$sub)
					}
					newDelta.retain(length, {
						attributes: attributeOperations.transform(thisOp.attributes, otherOp.attributes, hasPriority),
						set: attributeOperations.transform(thisOp.$set, otherOp.$set, hasPriority),
						subOps: newSubs
					})
				}
			}
		}

		return newDelta.chop()
	}

	transformPosition (path, ops = this.ops) {
		if (!path.length) return path
		const iter = new Iterator(ops)
		let offset = 0
		let index = path[0]
		while (iter.hasNext() && offset <= index) {
			const type = iter.peekType()
			const hasSub = type === 'retain' && iter.peek().$sub
			const op = iter.next(hasSub ? 1 : Infinity)
			const length = iter.getOpLength(op)
			if (type === 'delete') {
				index -= length
				if (offset > index) {
					// passed the original position with a delete. If there are deeper levels, we are booted out
					path.splice(0, Infinity, Math.max(0, index))
					return path
				}
				continue
			} else if (type === 'insert') {
				index += length
			} else if (type === 'retain' && hasSub && offset === index) {
				const subOps = op.$sub instanceof Array ? op.$sub : (op.$sub.items || op.$sub.text)
				if (subOps) path.splice(1, Infinity, ...this.transformPosition(path.slice(1), subOps))
			}
			offset += length
		}
		path[0] = index
		return path
	}

	// plaintext diffing
	static diff (a, b) {
		const aDelta = new Delta().insert(a)
		const bDelta = new Delta().insert(b)
		return aDelta.diff(bDelta)
	}
}
