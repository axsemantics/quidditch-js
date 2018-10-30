
const DELTA = Symbol('DELTA')
const DELTA_STR = Symbol('DELTA_STR')
const BASE_TYPES = {
	DELTA,
	DELTA_STR
}

const SUBTYPES = {}

export { SUBTYPES, BASE_TYPES }

export function setSubtypes (newSubtypes) {
	Object.assign(SUBTYPES, newSubtypes)
}
