import babel from '@rollup/plugin-babel'

export default {
	input: 'src/index.js',
	output: {
		format: 'es',
		file: 'dist/quidditch.es.js'
	},
	plugins: [
		babel({
			babelHelpers: 'bundled'
		})
	],
	external: ['events', 'fast-diff', 'deep-equal', 'lodash/cloneDeep', 'lodash/isEqual', 'lodash/cloneDeepWith', 'lodash/isEqualWith']
}
