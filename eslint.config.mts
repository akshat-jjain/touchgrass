import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    {
        ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**']
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
        languageOptions: { globals: globals.node }
    },
    {
        files: ['apps/web/**/*.{ts,tsx}'],
        languageOptions: { globals: globals.browser },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
        }
    },
    {
        files: ['**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
        }
    },
    eslintConfigPrettier
]);
