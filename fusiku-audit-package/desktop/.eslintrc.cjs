module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
  extends: ['eslint:recommended'],
  ignorePatterns: ['node_modules', 'dist'],
};
