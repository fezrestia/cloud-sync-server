// System Test for Architecture Map Web.

// Setup chrome web driver.
let webdriver = require("selenium-webdriver");
let driver = new webdriver.Builder()
    .withCapabilities(webdriver.Capabilities.chrome())
    .build();



// Sample.
driver.get("https://www.google.co.jp/").then(function() {
  driver.quit();
});

