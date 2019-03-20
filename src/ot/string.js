// This class correctly handles the counting of unicode code points
// and provides the same behaviour as python strings
// we need this to play nice with the backend

// all standard methods follow the js string specs https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String

export default class DeltaString {
	constructor (nativeString = '') {
		let characterArray
		if (nativeString instanceof Array) {
			characterArray = nativeString
			nativeString = characterArray.join('')
		} else {
			characterArray = Array.from(nativeString)
		}
		Object.defineProperty(this, 'nativeString', {value: nativeString})
		Object.defineProperty(this, 'characterArray', {value: characterArray})
		Object.defineProperty(this, 'length', {value: characterArray.length})
	}

	// extensions

	// computes the correct DeltaString index from a native index
	transformIndex (nativeIndex) {
		throw new Error('NOT IMPLEMENTED')
	}

	// standard methods

	[Symbol.iterator] () {
		return this.characterArray[Symbol.iterator]()
	}

	concat () {
		return new DeltaString(this.nativeString.concat(...arguments))
	}

	indexOf (other) {
		const otherArray = other instanceof DeltaString ? other.characterArray : Array.from(other)
		return this.characterArray.findIndex((character, index) => {
			for (let i = 0; i < otherArray.length; i++) {
				if (this.characterArray[index + i] !== otherArray[i]) return false
			}
			return true
		})
	}

	slice (beginIndex, endIndex) {
		return new DeltaString(this.characterArray.slice(beginIndex, endIndex))
	}

	substring (indexStart, indexEnd) {
		indexStart = Math.max(0, Math.min(this.length, indexStart))
		indexEnd = Math.max(0, Math.min(this.length, indexEnd))
		return indexStart <= indexEnd ? this.slice(indexStart, indexEnd) : this.slice(indexEnd, indexStart)
	}

	substr (start, length) {
		if (length < 0) {
			length = 0
		}
		if (length !== undefined && start !== 0) {
			length = Math.sign(start) * (Math.abs(start) + length)
		}
		return this.slice(start, length)
	}

	valueOf () {
		return this.nativeString
	}

	toString () {
		return this.nativeString
	}

	toJSON () {
		return this.nativeString
	}

	equals (other) {
		return this == other // eslint-disable-line eqeqeq
	}

	// charAt
	// charCodeAt
	// codePointAt
	// includes
	// endsWith
	// lastIndexOf
	// localeCompare
	// match
	// matchAll
	// normalize
	// padEnd
	// padStart
	// repeat
	// replace
	// search
	// split
	// startsWith
	// toLocaleLowerCase
	// toLocaleUpperCase
	// toLowerCase
	// toSource
	// toUpperCase
	// trim
	// trimStart
	// trimLeft
	// trimEnd
	// trimRight
}
