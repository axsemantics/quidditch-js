import babel from 'rollup-plugin-babel'
import inject from 'rollup-plugin-inject'
export default {
	entry: 'src/index.js',
	format: 'cjs',
	plugins: [babel(), inject({
		include: 'src/index.js',
		WebSocket: 'ws'
	})],
	dest: 'dist/quidditch.js',
	external: ['ws', 'events', 'fast-diff', 'deep-equal']
}
