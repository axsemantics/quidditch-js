const { setSubtypes, BASE_TYPES } = require('../../dist/quidditch.js')
// just set types right here
setSubtypes({
	switch: {
		items: BASE_TYPES.DELTA
	},
	case: {
		items: BASE_TYPES.DELTA,
		condition: BASE_TYPES.DELTA_STR
	},
	random: {
		items: BASE_TYPES.DELTA
	},
	container: {
		id: String,
		container_type: String,
		text: BASE_TYPES.DELTA_STR,
		lemma: BASE_TYPES.DELTA_STR
	},
	mapParent: {
		name: String,
		items: BASE_TYPES.DELTA_MAP
	},
	mapItem: {
		itemDelta: BASE_TYPES.DELTA
	}
})

const fixtures = {
	flatObjectsOps () {
		return [{'insert': 'abc'}, {'insert': {'_t': 'container'}}, {'insert': {'_t': 'case'}}, {'insert': 'def'}]
	},
	opRetainA () {
		return {
			retain: 1,
			$sub: [{
				retain: 1,
				$sub: [{
					retain: 1,
					$sub: {
						text: [{insert: 'a'}]
					},
					$set: {
						container_type: 'grammar',
						attributes: {gender: 'f'}
					}
				}]
			}]
		}
	},
	opRetainB () {
		return {
			retain: 1,
			$sub: {
				text: [{insert: 'b'}]
			}
		}
	},
	deltaState () {
		return [{
			insert: 'ab'
		}, {
			insert: {
				_t: 'random',
				items: [{
					insert: {
						_t: 'switch',
						items: [{
							insert: {
								_t: 'case',
								condition: '3 > 2',
								items: [{
									insert: {
										_t: 'container',
										text: ''
									}
								}]
							}
						}]
					}
				}, {
					insert: {
						_t: 'container',
						text: ''
					}
				}]
			}
		}]
	},
	compactState () {
		return [
			'ab', {
				_t: 'random',
				items: [{
					_t: 'case',
					condition: '3 > 2',
					items: [{
						_t: 'container',
						text: ''
					}]
				}, {
					_t: 'container',
					text: ''
				}]
			}
		]
	}
}

module.exports = fixtures
