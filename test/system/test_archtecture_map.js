// System Test for Architecture Map Web.

// Setup chrome web driver.
const webdriver = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const options = new chrome.Options();
options.addArguments( [
//    "--headless",
] );
const driver = new webdriver.Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();



// Sample.
driver.get("https://www.google.co.jp/").then(function() {
  driver.quit();
});

