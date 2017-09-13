import babel from 'rollup-plugin-babel'

export default {
	entry: 'src/index.js',
	format: 'es',
	plugins: [babel()],
	dest: 'dist/quidditch.es.js',
	external: ['events', 'fast-diff', 'deep-equal']
}
