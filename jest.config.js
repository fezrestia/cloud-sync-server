module.exports = {
    "roots": [
        "<rootDir>/src",
    ],
    "transform": {
        ".*\.tsx?$": "ts-jest",
    },
    "testRegex": "\.(test|spec)\.(jsx?|tsx?)$",
    "moduleFileExtensions": [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node",
    ],
    "moduleNameMapper": {
        "\.(css|jpg|png)$": "<rootDir>/src/empty-module.js"
    },
    "collectCoverageFrom": [
        "src/**/*.{ts,tsx}",
        "!src/**/*.{test,spec}.{ts,tsx}"
    ]
}
