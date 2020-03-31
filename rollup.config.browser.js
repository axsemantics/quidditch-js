import babel from 'rollup-plugin-babel'

export default {
	input: 'src/index.js',
	output: {
		format: 'cjs',
		file: 'dist/quidditch.browser.js'
	},
	plugins: [babel()],
	external: ['events', 'fast-diff', 'lodash/cloneDeep', 'lodash/isEqual', 'lodash/cloneDeepWith', 'lodash/isEqualWith']
}
