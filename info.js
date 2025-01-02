const fs = require('fs');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');

(async () => {
  let driver;
  try {
    console.log("Launching Chrome with Profile 5...");

    // Define Chrome profile path
    const chromeProfilePath = '/Users/damandeepsinghsatija/Library/Application Support/Google/Chrome';

    const options = new chrome.Options();
    options.addArguments('--start-maximized'); // Open browser maximized
    options.addArguments(`--user-data-dir=${chromeProfilePath}`); // Use your Chrome user data directory
    options.addArguments('--profile-directory=Profile 5'); // Specify the exact profile directory

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    console.log("Browser launched with Profile 5.");

    // Navigate to MakeMyTrip
    await driver.get("https://www.makemytrip.com");
    console.log("Logged in successfully using saved session. Keeping browser open...");

    // Perform any further actions here...

    // Keep the browser open
    await new Promise(() => {}); // Prevent script from exiting
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
})();
