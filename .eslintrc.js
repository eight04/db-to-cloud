module.exports = {
	"env": {
		"es6": true,
		"node": true
	},
	"rules": {
    "no-template-curly-in-string": "error",
		"no-use-before-define": ["error", "nofunc"],
    "require-atomic-updates": "off",
		"semi": ["error", "always"]
	},
	"extends": [
		"eslint:recommended"
	],
  "parserOptions": {
    "ecmaVersion": 2018
  },
  "overrides": [
    {
      "files": ["rollup.config.js"],
      "parserOptions": {
        "sourceType": "module"
      }
    }
  ]
};
