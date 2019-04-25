import babel from 'rollup-plugin-babel'
import inject from 'rollup-plugin-inject'
export default {
	input: 'src/index.js',
	output: {
		format: 'cjs',
		file: 'dist/quidditch.js'
	},
	plugins: [babel(), inject({
		include: 'src/index.js',
		WebSocket: 'ws'
	})],
	external: ['ws', 'events', 'fast-diff', 'lodash/cloneDeep', 'lodash/isEqual', 'lodash/cloneDeepWith', 'lodash/isEqualWith']
}
