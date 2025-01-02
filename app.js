require('dotenv').config(); // Load MMT_EMAIL and MMT_PASSWORD from .env

const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async () => {
  let driver;
  try {
    console.log("Launching Chrome with stealth options...");
    const options = new chrome.Options();
    options.addArguments('--start-maximized'); // Maximize the browser
    options.addArguments('--disable-blink-features=AutomationControlled'); // Disable automation detection
    options.addArguments('--disable-infobars'); // Hide "Chrome is being controlled by automated software"
    options.addArguments('--no-sandbox'); // Necessary for some environments
    options.addArguments('--disable-dev-shm-usage'); // Prevent memory issues in some environments
    options.setUserPreferences({
      credentials_enable_service: false,
      profile: {
        password_manager_enabled: false,
      },
    });

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
    console.log("Browser launched with stealth options.");

    // Navigate to MakeMyTrip
    console.log("Navigating to makemytrip.com...");
    await driver.get("https://www.makemytrip.com");
    await driver.wait(until.elementLocated(By.css('body')), 30000);
    console.log("Main page loaded.");

    // Handle language/location popup
    try {
      const langPopupClose = await driver.wait(
        until.elementLocated(By.css('.langCardClose')),
        5000
      );
      await langPopupClose.click();
      console.log("Closed language/location popup.");
    } catch (err) {
      console.log("No language/location popup found. Continuing...");
    }

    // Wait for the modal and click "Login by Email"
    await driver.sleep(2000);
    console.log("Looking for email login button...");
    const emailIcon = await driver.wait(
      until.elementLocated(By.css('img[data-cy="signInByMailButton"]')),
      10000
    );
    await emailIcon.click();
    console.log("Clicked the Email icon.");

    // Fill in the email
    console.log("Waiting for email input...");
    const emailField = await driver.wait(
      until.elementLocated(By.css('input[data-cy="userName"]')),
      10000
    );
    await emailField.sendKeys(process.env.MMT_EMAIL);
    console.log("Entered email.");

    // Simulate a native mouse click for the Continue button
    console.log("Waiting for Continue button...");
    const continueBtn = await driver.wait(
      until.elementLocated(By.css('button[data-cy="continueBtn"]')),
      10000
    );

    await driver.actions().move({ origin: continueBtn }).click().perform();
    console.log("Simulated a native click on the Continue button.");

    // Fill in the password
    console.log("Waiting for password input...");
    const passField = await driver.wait(
      until.elementLocated(By.css('input[data-cy="password"]')),
      10000
    );
    await passField.sendKeys(process.env.MMT_PASSWORD);
    console.log("Entered password (hidden).");

    // Simulate a native mouse click for the Login button
    console.log("Waiting for Login button...");
    const loginBtn = await driver.wait(
      until.elementLocated(By.css('button[data-cy="login"]')),
      10000
    );

    await driver.actions().move({ origin: loginBtn }).click().perform();
    console.log("Simulated a native click on the Login button.");

    // Wait for potential login success
    console.log("Waiting for login to complete...");
    await driver.wait(until.urlContains('dashboard'), 15000); // Adjust URL condition as per MakeMyTrip's login flow
    console.log("Login completed successfully!");

    // Keep the browser open indefinitely
    console.log("\nLogin flow completed. Keeping browser open...");
    await new Promise(() => {}); // Prevent script from exiting
  } catch (err) {
    console.error("Error during login flow:", err);
  }
})();
