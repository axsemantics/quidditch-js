
const DELTA = Symbol('DELTA')
const DELTA_STR = Symbol('DELTA_STR')
const DELTA_MAP = Symbol('DELTA_MAP')
const BASE_TYPES = {
	DELTA,
	DELTA_STR,
	DELTA_MAP
}

const SUBTYPES = {}

export { SUBTYPES, BASE_TYPES }

export function setSubtypes (newSubtypes) {
	Object.assign(SUBTYPES, newSubtypes)
}
