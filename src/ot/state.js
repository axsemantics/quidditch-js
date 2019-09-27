import Delta from './delta'
import OpIterator from './op-iterator'
import DeltaString from './string'
import { SUBTYPES, BASE_TYPES } from './subtypes'
import equal from 'lodash/isEqual'

const applyAttributes = function (attributes, changes) {
	for (const [key, change] of Object.entries(changes)) {
		if (change === null) {
			delete attributes[key]
		} else {
			attributes[key] = change
		}
	}
	if (Object.keys(attributes).length === 0) {
		return
	}
	return attributes
}

const checkMappiness = function (op) {
	return (op.insert && op.$set) || typeof op.retain === 'string' || typeof op.delete === 'string'
}

const applySub = function (current, $sub, setFunc, deleteFunc, trackedObjects) {
	const typeMark = current._t
	if (!SUBTYPES[typeMark]) throw new TypeError(`Invalid item type ${typeMark}`)
	const typeSpec = SUBTYPES[typeMark]
	const subs = $sub instanceof Array ? {items: $sub} : $sub || {}
	for (const [key, value] of Object.entries(subs)) {
		if (typeSpec[key] === BASE_TYPES.DELTA_STR) {
			setFunc(current, key, new DeltaString(new Delta(value).apply(current[key] || '')))
		} else if (typeSpec[key] === BASE_TYPES.DELTA || typeSpec[key] === BASE_TYPES.DELTA_MAP) {
			const results = applyOpsToState(current[key], value, setFunc, deleteFunc)
			// merge tracked objects into parent
			for (const [type, {added, removed}] of Object.entries(results)) {
				if (trackedObjects[type]) {
					trackedObjects[type].added.push(...added)
					trackedObjects[type].removed.push(...removed)
				} else {
					trackedObjects[type] = {added, removed}
				}
			}
		} else {
			throw new TypeError(` ${typeMark}.${key} is not a delta`)
		}
	}
}

const defaultSetFunc = function (obj, key, value) { obj[key] = value }
const defaultDeleteFunc = function (obj, key) { delete obj[key] }

// applies ops as reactive as possible to state
// tracks and returns deeply added and removed typed ops (with _t)
// to properly work with Vue, set setFunc to Vue.set and deleteFunc to Vue.delete
export function applyOpsToState (state, ops, setFunc = defaultSetFunc, deleteFunc = defaultDeleteFunc) {
	const trackedObjects = {}
	const trackObject = function (action, obj) {
		if (obj?._t) {
			if (!trackedObjects[obj._t]) {
				trackedObjects[obj._t] = {added: [], removed: []}
			}
			trackedObjects[obj._t][action].push(obj)
		}
		if (obj?.items) {
			obj.items.forEach(item => trackObject(action, item.insert))
		}
	}
	if (ops.some(checkMappiness)) {
		// assume state is a plain object
		for (const op of ops) {
			if (typeof op.insert === 'string' && op.$set) {
				const newObj = Object.assign({}, op.$set, {_id: op.insert})
				setFunc(state, op.insert, newObj)
				trackObject('added', newObj)
			} else if (typeof op.retain === 'string') {
				if (op.$set) {
					for (const [key, value] of Object.entries(op.$set)) {
						setFunc(state[op.retain], key, value === null ? undefined : value)
					}
				}
				if (op.$sub) {
					applySub(state[op.retain], op.$sub, setFunc, deleteFunc, trackedObjects)
				}
			} else if (typeof op.delete === 'string') {
				trackObject('removed', state[op.delete])
				deleteFunc(state, op.delete)
			}
		}
	} else {
		const iter = new OpIterator(ops)
		let stateIndex = 0
		let stateOffset = 0
		// state = Object.assign({}, state) // always shallow copy?
		while (iter.hasNext()) {
			if (stateIndex >= state.length) {
				const op = iter.next()
				if (!op.insert) throw new Error('Operation beyond end of state')
				const stateOp = state[state.length - 1]
				if (stateOp && op.insert instanceof DeltaString && stateOp.insert instanceof DeltaString && equal(stateOp.attributes, op.attributes)) {
					stateOp.insert += op.insert
				} else {
					state.push(op)
					trackObject('added', op.insert)
				}
				stateIndex++
				continue
			}
			const current = state[stateIndex]
			const length = Math.min(current.insert instanceof DeltaString ? current.insert.length - stateOffset : 1, iter.peekLength())
			const op = iter.next(length)
			if (current.insert instanceof DeltaString) {
				if (typeof op.retain === 'number') {
					if (op.attributes) {
						// split current
						const [before, center, after] = [
							current.insert.slice(0, stateOffset),
							current.insert.slice(stateOffset, stateOffset + op.retain),
							current.insert.slice(stateOffset + op.retain)
						]
						const oldAttributes = current.attributes
						const newOp = {
							insert: center,
							attributes: applyAttributes(Object.assign({}, oldAttributes), op.attributes)
						}
						const prev = state[stateIndex - 1]
						const next = state[stateIndex + 1]
						if (equal(current.attributes, newOp.attributes)) {
							// do nothing if attributes don't change
						} else if (!before.length && prev?.insert instanceof DeltaString && equal(prev.attributes, newOp.attributes)) {
							// merge to front
							prev.insert = prev.insert.concat(center)
							state.splice(stateIndex, 1)
							stateIndex--
						} else if (!after.length && next?.insert instanceof DeltaString && equal(next.attributes, newOp.attributes)) {
							// merge to back
							next.insert = center.concat(next.insert)
							if (before.length) {
								current.insert = before
							} else {
								state.splice(stateIndex, 1)
							}
						} else if (before.length) {
							current.insert = before
							stateIndex++
							state.splice(stateIndex, 0, newOp)
						} else {
							current.insert = center
							current.attributes = newOp.attributes
						}
						if (after.length) {
							const afterOp = {insert: after}
							if (oldAttributes) afterOp.attributes = oldAttributes
							state.splice(stateIndex + 1, 0, afterOp)
						}
					}
					stateOffset += length
				} else if (typeof op.delete === 'number') {
					current.insert = current.insert.splice(stateOffset, length)
				} else if (op.insert instanceof DeltaString) {
					// TODO only if same attributes
					current.insert = current.insert.splice(stateOffset, 0, ...op.insert)
					stateOffset += op.insert.length
				} else if (typeof op.insert === 'object') {
					// split current
					const [before, after] = [current.insert.slice(0, stateOffset), current.insert.slice(stateOffset)]
					if (before.length) {
						current.insert = before
						stateIndex++
						state.splice(stateIndex, 0, op)
					} else {
						current.insert = op.insert
					}
					stateIndex++
					if (after.length) {
						state.splice(stateIndex, 0, {insert: after})
					}
					stateOffset = 0
				}
				if (state[stateIndex].insert.length === 0) {
					state.splice(stateIndex, 1)
				} else if (stateOffset >= state[stateIndex].insert.length && !(iter.peek()?.insert instanceof DeltaString)) {
					// if the next op is a plain insert, stay in current
					stateIndex++
					stateOffset = 0
				}
			}	else if (typeof op.retain === 'number') {
				if (op.$set) {
					for (const [key, value] of Object.entries(op.$set)) {
						setFunc(state[stateIndex].insert, key, value === null ? undefined : value)
					}
				}
				if (op.$sub) {
					applySub(current.insert, op.$sub, setFunc, deleteFunc, trackedObjects)
				}
				// apply attributes to complex insert. Since length is always 1, we need no splitting
				if (op.attributes) {
					if (!current.attributes) {
						setFunc(current, 'attributes', op.attributes)
					} else {
						applyAttributes(current.attributes, op.attributes)
					}
				}
				stateIndex++
			} else if (typeof op.delete === 'number') {
				// merge adjacent plain inserts
				const prev = state[stateIndex - 1]
				const next = state[stateIndex + 1]
				if (prev?.insert instanceof DeltaString && next?.insert instanceof DeltaString && equal(prev?.attributes, next?.attributes)) {
					stateOffset = prev.insert.length
					prev.insert = prev.insert.concat(next.insert)
					state.splice(stateIndex, 2)
					stateIndex--
				} else {
					state.splice(stateIndex, 1)
				}
			} else if (op.insert) {
				const prev = state[stateIndex - 1]
				if (op.insert instanceof DeltaString && prev?.insert instanceof DeltaString && equal(prev.attributes, op.attributes)) {
					// merge to front
					prev.insert = prev.insert.concat(op.insert)
				} else {
					state.splice(stateIndex, 0, op)
					stateIndex++
				}
				if (op.$set) {
					current[op.insert] = op.$set
				}
			}
			if (op.insert) {
				trackObject('added', op.insert)
			}
			if (op.delete) {
				trackObject('removed', current.insert)
			}
		}
	}
	return trackedObjects
}
