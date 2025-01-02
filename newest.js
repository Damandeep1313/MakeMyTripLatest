/***** app.js *****/
const express = require('express');
const { Builder, By, until, Actions } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config(); // Load environment variables

const app = express();
const port = 3001; // Changed port to avoid EADDRINUSE

/**
 * Helper function to type text one character at a time.
 * @param {WebElement} element The Selenium element to type into
 * @param {string} text The text to type
 * @param {number} delayMs Delay (ms) between each character
 * @param {WebDriver} driver The Selenium driver (needed for sleeps)
 */
async function typeSlowly(element, text, delayMs, driver) {
  for (const char of text) {
    await element.sendKeys(char);
    await driver.sleep(delayMs);
  }
}

/**
 * Helper function to take screenshots.
 * @param {WebDriver} driver The Selenium driver
 * @param {string} filename The filename for the screenshot
 */
async function takeScreenshot(driver, filename) {
  const image = await driver.takeScreenshot();
  fs.writeFileSync(filename, image, 'base64');
  console.log(`Screenshot saved as ${filename}`);
}

/**
 * Helper function to retry an asynchronous action multiple times.
 * @param {Function} action - The asynchronous function to execute.
 * @param {number} retries - Number of retry attempts.
 * @param {number} delayMs - Delay (ms) between attempts.
 * @returns {Promise<*>} - Resolves with the action's result or rejects after all retries fail.
 */
async function retryAction(action, retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await action();
    } catch (error) {
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) {
        throw new Error(`All ${retries} attempts failed.`);
      }
      console.log(`Retrying in ${delayMs / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

app.get('/scrape', async (req, res) => {
  console.log("Incoming /scrape request...");

  // Extract query params
  const {
    firstName,
    lastName,
    email,
    mobile,
    panNumber,
    upiId
  } = req.query;

  // Basic validation
  if (!firstName || !lastName || !email || !mobile || !panNumber) {
    console.error("Missing required query parameters for booking.");
    return res.status(400).send("Missing required query parameters for booking.");
  }

  let driver;
  try {
    console.log("Launching Selenium WebDriver...");
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--start-maximized'); // Launch browser maximized
    // Uncomment the following line to run in headless mode
    // chromeOptions.addArguments('--headless');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();
    console.log("Browser launched.");

    // 1) Navigate to MMT Delhi hotels page
    console.log("Navigating to MMT Delhi hotels...");
    await driver.get("https://www.makemytrip.com/hotels-international/india/delhi-hotels/");
    await driver.wait(until.elementLocated(By.css('body')), 60000);
    console.log("Main listing page loaded.");

    // 2) Wait for the first hotel listing
    console.log("Waiting for #Listing_hotel_0...");
    const hotelListing = await driver.wait(
      until.elementLocated(By.css('#Listing_hotel_0')),
      60000
    );
    await driver.wait(
      until.elementIsVisible(hotelListing),
      60000
    );
    console.log("Hotel listing is visible.");

    // 3) Click the first hotel listing and handle new tab
    console.log("Clicking the first hotel listing...");
    const oldTabs = await driver.getAllWindowHandles();
    await hotelListing.click();

    console.log("Waiting 3 seconds to see if a new tab opens...");
    await driver.sleep(3000);

    const newTabs = await driver.getAllWindowHandles();
    let detailTab = await driver.getWindowHandle();
    if (newTabs.length > oldTabs.length) {
      const diff = newTabs.filter(x => !oldTabs.includes(x));
      if (diff.length) detailTab = diff[0];
    }
    await driver.switchTo().window(detailTab);
    console.log("Switched to detail page tab.");

    // Take screenshot after switching tabs
    await takeScreenshot(driver, 'after_switching_tabs.png');

    // 4) Wait for detail page to load
    console.log("Waiting for <body> on the detail page...");
    await driver.wait(until.elementLocated(By.css('body')), 60000);
    console.log("Detail page loaded.");

    // 5) Click the 'Search' button if present
    console.log("Looking for #hsw_search_button...");
    try {
      const searchBtn = await driver.wait(
        until.elementLocated(By.css('#hsw_search_button')),
        15000
      );
      await driver.wait(until.elementIsVisible(searchBtn), 15000);
      await searchBtn.click();
      console.log("Search button clicked.");

      // Take screenshot after clicking search
      await takeScreenshot(driver, 'after_click_search.png');
    } catch {
      console.log("No search button or not clickable. Continuing...");
    }
    await driver.sleep(3000);

    // 6) Click "BOOK THIS NOW"
    console.log("Looking for .bkngOption__cta (BOOK THIS NOW)...");
    try {
      const bookThisNowBtn = await driver.wait(
        until.elementLocated(By.css('.bkngOption__cta')),
        15000
      );
      await driver.wait(until.elementIsVisible(bookThisNowBtn), 15000);
      await bookThisNowBtn.click();
      console.log("BOOK THIS NOW clicked.");

      // Take screenshot after clicking BOOK THIS NOW
      await takeScreenshot(driver, 'after_click_book_this_now.png');
    } catch (err) {
      console.error("BOOK THIS NOW direct click failed, trying JS:", err);
      await driver.executeScript(() => {
        const btn = document.querySelector('.bkngOption__cta');
        if (btn) btn.click();
      });
      console.log("BOOK THIS NOW clicked via JS injection.");

      // Take screenshot after JS injection click
      await takeScreenshot(driver, 'after_js_click_book_this_now.png');
    }
    await driver.sleep(2000);

    // 7) Fill traveler form (slowly)
    console.log("Filling traveler form (typing slowly)...");
    const fNameInput = await driver.wait(
      until.elementLocated(By.css('#fName')),
      15000
    );
    await driver.wait(until.elementIsVisible(fNameInput), 15000);
    await typeSlowly(fNameInput, firstName, 300, driver);

    const lNameInput = await driver.findElement(By.css('#lName'));
    await typeSlowly(lNameInput, lastName, 300, driver);

    const emailInput = await driver.findElement(By.css('#email'));
    await typeSlowly(emailInput, email, 200, driver);

    const mobileInput = await driver.findElement(By.css('#mNo'));
    await typeSlowly(mobileInput, mobile, 200, driver);
    console.log("Traveler details typed slowly.");

    // Take screenshot after filling traveler details
    await takeScreenshot(driver, 'after_filling_traveler_details.png');

    // 8) Fill PAN Number if the field appears
    console.log("Checking if 'ENTER PAN HERE' input appears...");
    try {
      const panField = await driver.wait(
        until.elementLocated(By.css('input[placeholder="ENTER PAN HERE"]')),
        5000
      );
      await typeSlowly(panField, panNumber, 200, driver);
      console.log(`PAN field found and typed slowly: ${panNumber}`);

      // Take screenshot after entering PAN
      await takeScreenshot(driver, 'after_filling_pan.png');
    } catch {
      console.log("No new PAN field found. Moving on...");
    }

    // 9) Click Terms & Conditions checkbox
    console.log("Clicking T&C checkbox...");
    try {
      const tncCheckbox = await driver.findElement(By.css('.checkboxWithLblWpr__label'));
      await tncCheckbox.click();
      console.log("T&C clicked.");

      // Take screenshot after clicking T&C
      await takeScreenshot(driver, 'after_clicking_tnc.png');
    } catch {
      console.log("T&C checkbox not found, skipping...");
    }

    // 10) Click "Pay Now"
    console.log("Looking for Pay Now button (.btnContinuePayment.primaryBtn.capText)...");
    try {
      const payNowBtn = await driver.wait(
        until.elementLocated(By.css('.btnContinuePayment.primaryBtn.capText')),
        15000
      );
      await driver.wait(until.elementIsVisible(payNowBtn), 15000);
      await payNowBtn.click();
      console.log("Pay Now clicked.");

      // Take screenshot after clicking Pay Now
      await takeScreenshot(driver, 'after_clicking_pay_now.png');
    } catch (error) {
      console.error("Failed to click Pay Now:", error);
    }

    // 11) Wait for payment options to load
    console.log("Waiting for .payment__options__tab...");
    await driver.wait(until.elementLocated(By.css('.payment__options__tab')), 30000);
    await driver.wait(
      until.elementIsVisible(driver.findElement(By.css('.payment__options__tab'))),
      30000
    );
    console.log("Payment options tab is visible.");

    // Take screenshot after payment options load
    await takeScreenshot(driver, 'after_payment_options_loaded.png');

    // 12) Scroll down to reveal UPI fields
    console.log("Scrolling down to find UPI fields...");
    await driver.executeScript("window.scrollBy(0, 600);");
    await driver.sleep(1000);

    // 13) Enter UPI ID if provided
    if (upiId) {
      console.log(`Entering UPI ID slowly: ${upiId}`);
      const upiInput = await driver.wait(
        until.elementLocated(By.css('#inputVpa')),
        15000
      );
      await driver.wait(until.elementIsVisible(upiInput), 15000);
      await typeSlowly(upiInput, upiId, 250, driver);
      console.log("UPI ID entered slowly.");

      // Take screenshot after entering UPI
      await takeScreenshot(driver, 'after_filling_upi.png');
    } else {
      console.log("No UPI ID provided, skipping UPI step.");
    }

    // 14, 15, 16) Continuous Loop: Click "Verify and Pay" -> Click "SKIP" -> Repeat until "SKIP" no longer appears
    console.log("Starting continuous loop: Click 'Verify and Pay' -> Click 'SKIP' -> Repeat...");

    // Define the maximum number of iterations to prevent infinite loops
    const MAX_ITERATIONS = 10;
    let iterationLoop = 0;
    let skipExists = true;

    while (skipExists && iterationLoop < MAX_ITERATIONS) {
      iterationLoop++;
      console.log(`\n--- Iteration ${iterationLoop} ---`);

      // Step 1: Click "Verify and Pay" with enhanced function
      try {
        console.log("Looking for final pay button (.prime__btn.paynow__btn)...");
        
        // Define the action to click "Verify and Pay"
        const clickVerifyPay = async () => {
          const finalPayBtn = await driver.wait(
            until.elementLocated(By.css('.prime__btn.paynow__btn')),
            15000
          );
          await driver.wait(until.elementIsVisible(finalPayBtn), 15000);

          // Scroll into view
          await driver.executeScript("arguments[0].scrollIntoView({ behavior: 'smooth', block: 'center' });", finalPayBtn);
          await driver.sleep(1000); // Wait for scrolling

          // Try clicking using Actions API
          try {
            const actions = driver.actions({ async: true });
            await actions.move({ origin: finalPayBtn }).pause(500).click().perform();
            console.log("Clicked 'Verify and Pay' using Actions API.");
          } catch (error) {
            console.warn("Actions API click failed, attempting JavaScript click.");
            await driver.executeScript("arguments[0].click();", finalPayBtn);
            console.log("Clicked 'Verify and Pay' using JavaScript.");
          }

          // Take screenshot after clicking
          await takeScreenshot(driver, `after_click_verify_pay_iter_${iterationLoop}.png`);
        };

        // Retry clicking "Verify and Pay" up to 5 times with 2-second intervals
        await retryAction(clickVerifyPay, 5, 2000);

        console.log("Final Payment Request (verify/pay) clicked.");
      } catch (error) {
        console.error(`Failed to click 'Verify and Pay' on iteration ${iterationLoop}:`, error);
        break; // Exit the loop on failure
      }

      // Step 2: Handle "SKIP" Button with retries
      try {
        console.log("Waiting for OTP modal with 'SKIP' button...");
        const otpModal = await driver.wait(
          until.elementLocated(By.css('section[data-cy="CommonModal_2"]')),
          15000
        );
        console.log("OTP modal appeared.");

        // Wait briefly to ensure the 'SKIP' button is loaded
        await driver.sleep(2000);

        // Define the action to click SKIP
        const clickSkip = async () => {
          const skipSpan = await driver.findElement(By.xpath("//section[@data-cy='CommonModal_2']//span[normalize-space()='SKIP']"));
          await skipSpan.click();
          console.log("Clicked 'SKIP' button.");
        };

        // Retry clicking SKIP up to 5 times with 2-second intervals
        await retryAction(clickSkip, 5, 2000);

        // Take screenshot after clicking SKIP
        await takeScreenshot(driver, `after_click_skip_otp_iter_${iterationLoop}.png`);

        // Wait for modal to close
        await driver.wait(
          until.stalenessOf(await driver.findElement(By.xpath("//section[@data-cy='CommonModal_2']//span[normalize-space()='SKIP']"))),
          10000
        );
        console.log("OTP modal closed after clicking 'SKIP'.");

        // Continue to the next iteration
      } catch (err) {
        console.log("No OTP modal or 'SKIP' button found. Assuming payment can proceed.");
        skipExists = false; // Exit the loop as "SKIP" is no longer present
      }
    }

    if (iterationLoop >= MAX_ITERATIONS) {
      console.warn(`Reached maximum iterations (${MAX_ITERATIONS}). Proceeding without further attempts.`);
    }

    console.log("\n--- Loop Ended ---");

    // 17) Wait and Close Browser
    console.log("All done. Waiting 30 seconds to observe...");
    await driver.sleep(30000);

    console.log("Flow completed. Closing browser...");
    await driver.quit();
    return res.status(200).send("Kindly approve the payment request, and the booking details will be shared with you at the email address that you provided.");
  } catch (error) {
    console.error("Error during scraping and booking:", error);
    if (driver) {
      try {
        await driver.quit();
      } catch {}
    }
    return res.status(500).send("An error occurred during scraping and booking.");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
