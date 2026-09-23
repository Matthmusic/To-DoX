import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores(['dist', '.claude/worktrees']), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs['recommended-latest'],
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    'no-console': 'warn',
    // Convention du projet : préfixer par _ un paramètre volontairement inutilisé (ex.
    // deleteNotificationForUser(notifId, _userId) -- userId fait partie de la forme
    // publique de l'action même si cette implémentation ne s'en sert pas). Sans ce
    // réglage, tseslint.configs.recommended ne reconnaît pas cette convention et remonte
    // une erreur à chaque usage légitime.
    '@typescript-eslint/no-unused-vars': ['error', {
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
    }],
  },
}])
