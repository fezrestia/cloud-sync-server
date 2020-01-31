// Web Driver for System Test.

import { Builder, ThenableWebDriver } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";

/**
 * Prepare web driver instance. Must be release it after test done.
 *
 * @param isHeadless boolean Headless browser is required or not.
 * @return Object WebDriver instance.
 */
export function prepareWebDriver(isHeadless: boolean): ThenableWebDriver {
  const options: chrome.Options = new chrome.Options();
  // WORKAROUND:
  //   @types/selenium-webdriver check failed by that args is expecting string, not string[]
  (options as any).addArguments( [
      "--log-level=ALL",
      "--disable-dev-shm-usage",
      "--no-sandbox",
  ] );
  if (isHeadless) {
    // WORKAROUND:
    //   @types/selenium-webdriver check failed by that args is expecting string, not string[]
    (options as any).addArguments( [
        "--headless",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--allow-insecure-localhost",
        "--allow-running-insecure-content",
        "disable-infobars",
    ] );
  }

  const driver = new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

  return driver;
}

/**
 * Release web driver instance.
 *
 * @param webDriver Object Web driver instance.
 */
export function releaseWebDriver(webDriver: ThenableWebDriver) {
  webDriver.quit();
}

