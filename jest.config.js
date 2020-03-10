module.exports = {
  verbose: true,

  roots: [
    "<rootDir>/test/unit",
  ],

  preset: "ts-jest",

  transform: {
    ".*\.tsx?$": "ts-jest",
  },

  globals: {
    "ts-jest": {
      tsConfig: "tsconfig.json",
      diagnostics: false
    }
  },

  testEnvironment: "node",

  testRegex: "\.(test|spec)\.(jsx?|tsx?)$",

  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node",
  ],

  collectCoverage: false,

  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.{test,spec}.{ts,tsx}"
  ],

  coverageDirectory: "<rootDir>/test_report",

}
