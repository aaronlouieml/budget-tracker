// Covers pure calculation logic only (services/financialMath.ts,
// services/debtAllocation.ts) - files with zero React Native/Expo imports.
// The rest of the app is exercised by manually testing on-device, since
// expo-sqlite needs a real device/simulator or the web/WASM build to run.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^expo-crypto$': '<rootDir>/__mocks__/expo-crypto.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
};
