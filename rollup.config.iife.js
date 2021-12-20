import babel from '@rollup/plugin-babel'
import node from 'rollup-plugin-polyfill-node'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
	input: 'src/index.js',
	output: {
		name: 'QuidditchClient',
		format: 'iife',
		file: 'dist/quidditch.iife.js'
	},
	plugins: [
		babel({
			babelHelpers: 'bundled',
			ignore: ['node_modules']
		}),
		node(),
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
