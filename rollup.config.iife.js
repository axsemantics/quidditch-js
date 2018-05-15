import babel from 'rollup-plugin-babel'
import builtins from 'rollup-plugin-node-builtins'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

export default {
	input: 'src/index.js',
	output: {
		name: 'QuidditchClient',
		format: 'iife',
		file: 'dist/quidditch.browser.js'
	},
	plugins: [
		babel({
			ignore: 'node_modules'
		}),
		builtins(),
		resolve({
			browser: true,
			jsnext: true,
			main: true
		}),
		commonjs({
			include: 'node_modules/**'
		})
	],
}
