module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/server/tests'],
  testMatch: ['**/*.test.js'],
  transform: {},
  clearMocks: true,
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/tests/**',
    '!server/index.js',
  ],
  coverageDirectory: 'coverage',
};