module.exports = {
	root: true,
	parser: '@babel/eslint-parser',
	parserOptions: {
		sourceType: 'module'
	},
	extends: 'standard',
	// add your custom rules here
	rules: {
		// allow paren-less arrow functions
		'arrow-parens': 0,
		// allow async-await
		'generator-star-spacing': 0,
		// allow debugger during development
		'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
		// OWN RULES
		'indent': [2, 'tab', { "SwitchCase": 1 }],
		'no-tabs': 0,
		'comma-dangle': 0, //perhaps always?
		'curly': 0,
		'no-return-assign': 0,
		'object-curly-spacing': 0
	},
	globals: {
		localStorage: false
	}
}
