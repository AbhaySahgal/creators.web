// @ts-check

import { configs, configure, globals } from './eslint-ps-standard.mjs';

export default configure(
	// TypeScript / TSX (React) – PS standard ES3 + TS rules
	{
		files: ['**/*.{ts,tsx}'],
		extends: configs.es3ts,
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname
			},
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			// temporary
			"prefer-const": "off",
			// we use these for grouping
			"@stylistic/padded-blocks": "off",
			// too many of these on client
			"@typescript-eslint/no-floating-promises": "off",
			// we use these for animations
			"@typescript-eslint/unbound-method": "off",
			"@typescript-eslint/restrict-template-expressions": ["error", {
				allow: [
					{ name: ['Error', 'URL', 'URLSearchParams'], from: 'lib' },
					{ name: ['ModifiableValue'], from: 'file' }
				],
				allowBoolean: false, allowNever: false, allowNullish: false, allowRegExp: false
			}]
		}
	},
	// Plain JS / JSX – PS standard ES3 rules
	{
		files: ['**/*.{js,jsx}'],
		extends: configs.es3,
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	}
);
