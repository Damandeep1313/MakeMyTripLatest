/***** app.js *****/
const express = require('express');
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const app = express();
const port = 3000;

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

  // Check required params
  if (!firstName || !lastName || !email || !mobile || !panNumber) {
    console.error("Missing required query parameters for booking.");
    return res.status(400).send("Missing required query parameters for booking.");
  }

  let driver;
  try {
    // 1. Launch Selenium (Chrome) with headless=false
    console.log("Launching Selenium WebDriver...");
    const chromeOptions = new chrome.Options();
    chromeOptions.addArguments('--start-maximized'); // for a visible browser
    // chromeOptions.addArguments('--headless'); // uncomment if you want headless

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    console.log("Browser launched.");

    // 2. Navigate to MMT hotels page
    console.log("Navigating to MMT Delhi hotels...");
    await driver.get("https://www.makemytrip.com/hotels-international/india/delhi-hotels/");
    await driver.wait(until.elementLocated(By.css('body')), 60000);
    console.log("Main listing page loaded.");

    // 3. Wait for the first listing
    console.log("Waiting for #Listing_hotel_0...");
    await driver.wait(until.elementLocated(By.css('#Listing_hotel_0')), 60000);
    await driver.wait(until.elementIsVisible(driver.findElement(By.css('#Listing_hotel_0'))), 60000);
    console.log("Hotel listing is visible.");

    // Capture old tabs
    const oldTabs = await driver.getAllWindowHandles();

    // 4. Click on the first listing
    console.log("Clicking the first hotel listing...");
    await driver.findElement(By.css('#Listing_hotel_0')).click();

    console.log("Waiting 3s to see if a new tab opens...");
    await driver.sleep(3000);

    // Check new tabs
    const newTabs = await driver.getAllWindowHandles();
    let detailTab = await driver.getWindowHandle();
    if (newTabs.length > oldTabs.length) {
      const diff = newTabs.filter(x => !oldTabs.includes(x));
      if (diff.length) detailTab = diff[0];
    }
    await driver.switchTo().window(detailTab);
    console.log("Switched to detail page tab.");

    // 5. Wait for the detail page body
    console.log("Waiting for <body> on the detail page...");
    await driver.wait(until.elementLocated(By.css('body')), 60000);
    console.log("Detail page loaded.");

    // 6. Click "Search" if visible (#hsw_search_button)
    console.log("Looking for #hsw_search_button...");
    try {
      const searchBtn = await driver.wait(
        until.elementLocated(By.css('#hsw_search_button')),
        15000
      );
      await driver.wait(until.elementIsVisible(searchBtn), 15000);
      await searchBtn.click();
      console.log("Search button clicked.");
    } catch (err) {
      console.log("Search button not found or not clickable. Continuing...");
    }

    await driver.sleep(3000);

    // 7. Click "BOOK THIS NOW" => .bkngOption__cta
    console.log("Looking for .bkngOption__cta (BOOK THIS NOW)...");
    try {
      const bookThisNowBtn = await driver.wait(
        until.elementLocated(By.css('.bkngOption__cta')),
        15000
      );
      await driver.wait(until.elementIsVisible(bookThisNowBtn), 15000);
      await bookThisNowBtn.click();
      console.log("BOOK THIS NOW clicked.");
    } catch (err) {
      console.error("BOOK THIS NOW direct click failed, trying JS:", err);
      await driver.executeScript(() => {
        const btn = document.querySelector('.bkngOption__cta');
        if (btn) btn.click();
      });
      console.log("BOOK THIS NOW clicked via JS injection.");
    }

    await driver.sleep(2000);

    // 8. Fill traveler form
    console.log("Filling traveler form...");
    const fNameInput = await driver.wait(until.elementLocated(By.css('#fName')), 15000);
    await driver.wait(until.elementIsVisible(fNameInput), 15000);
    await fNameInput.sendKeys(firstName);

    const lNameInput = await driver.findElement(By.css('#lName'));
    await lNameInput.sendKeys(lastName);

    const emailInput = await driver.findElement(By.css('#email'));
    await emailInput.sendKeys(email);

    const mobileInput = await driver.findElement(By.css('#mNo'));
    await mobileInput.sendKeys(mobile);
    console.log("Traveler details entered.");

    // 9. Possibly fill the 'ENTER PAN HERE' field
    console.log("Checking if 'ENTER PAN HERE' input appears...");
    try {
      const panField = await driver.wait(
        until.elementLocated(By.css('input[placeholder="ENTER PAN HERE"]')),
        5000
      );
      await driver.wait(until.elementIsVisible(panField), 5000);
      await panField.sendKeys(panNumber);
      console.log(`PAN field found and filled: ${panNumber}`);
    } catch (err) {
      console.log("No new PAN field found. Moving on...");
    }

    // 10. Click T&C
    console.log("Clicking T&C checkbox...");
    try {
      const tncCheckbox = await driver.findElement(By.css('.checkboxWithLblWpr__label'));
      await tncCheckbox.click();
      console.log("T&C clicked.");
    } catch (err) {
      console.log("T&C checkbox not found, skipping...");
    }

    // 11. Click "Pay Now" => .btnContinuePayment.primaryBtn.capText
    console.log("Looking for Pay Now button (.btnContinuePayment.primaryBtn.capText)...");
    try {
      const payNowBtn = await driver.wait(
        until.elementLocated(By.css('.btnContinuePayment.primaryBtn.capText')),
        15000
      );
      await driver.wait(until.elementIsVisible(payNowBtn), 15000);
      await payNowBtn.click();
      console.log("Pay Now clicked.");
    } catch (error) {
      console.error("Failed to click Pay Now:", error);
    }

    // 12. Wait for Payment options => .payment__options__tab
    console.log("Waiting for .payment__options__tab...");
    await driver.wait(until.elementLocated(By.css('.payment__options__tab')), 30000);
    await driver.wait(until.elementIsVisible(driver.findElement(By.css('.payment__options__tab'))), 30000);
    console.log("Payment options tab is visible.");

    // 13. Scroll to reveal UPI
    console.log("Scrolling down to find UPI fields...");
    await driver.executeScript("window.scrollBy(0, 600);");
    await driver.sleep(1000);

    // 14. If upiId is provided, fill #inputVpa
    if (upiId) {
      console.log(`Entering UPI ID: ${upiId}`);
      const upiInput = await driver.wait(
        until.elementLocated(By.css('#inputVpa')),
        15000
      );
      await driver.wait(until.elementIsVisible(upiInput), 15000);
      await upiInput.sendKeys(upiId);
      console.log("UPI ID entered.");
    } else {
      console.log("No UPI ID provided, skipping UPI input step.");
    }

    // 15. Click final Pay => .prime__btn
    console.log("Looking for final pay button (.prime__btn)...");
    try {
      const finalPayBtn = await driver.wait(
        until.elementLocated(By.css('.prime__btn')),
        15000
      );
      await driver.wait(until.elementIsVisible(finalPayBtn), 15000);
      await finalPayBtn.click();
      console.log("Payment Request Sent.");
    } catch (error) {
      console.error("Failed to click final Pay button:", error);
    }

    // 16. Try to click "SKIP" in the modal
    console.log("Looking for the 'SKIP' button in the modal...");
    try {
      await driver.wait(
        until.elementLocated(By.css('section[data-cy="CommonModal_2"]')),
        15000
      );
      // Use JS to click 'SKIP'
      await driver.executeScript(() => {
        const modal = document.querySelector('section[data-cy="CommonModal_2"]');
        if (!modal) return;
        const skipSpans = modal.querySelectorAll('span');
        const skipSpan = [...skipSpans].find(el => el.textContent.trim() === 'SKIP');
        if (skipSpan) skipSpan.click();
      });
      await driver.sleep(2000);
    } catch (err) {
      console.log("No modal found or 'SKIP' not visible.");
    }

    // 17. Possibly a second final pay
    console.log("Attempting second final pay (.prime__btn) if present...");
    try {
      const finalPayBtn2 = await driver.wait(
        until.elementLocated(By.css('.prime__btn')),
        5000
      );
      await driver.wait(until.elementIsVisible(finalPayBtn2), 5000);
      await finalPayBtn2.click();
      console.log("Second Payment Request Sent.");
    } catch (error) {
      console.log("No second final pay found or not clickable.");
    }

    // >>> ADD A WAIT HERE <<<
    console.log("Payment is done. Let's wait 30 seconds so you can observe the page...");
    await driver.sleep(30000);

    // >>> If you want the browser to remain open indefinitely, comment out driver.quit() below.
    // >>> Or set an even longer sleep.

    // ** If you prefer to keep the browser open, just comment out the next line: **
    // await driver.quit();

    console.log("Scraping flow completed. Browser is still open for 30s (or until closed).");
    return res.status(200).send("Scraping and booking completed (with UPI). Browser will close after script ends.");

  } catch (error) {
    console.error("Error during scraping and booking:", error);
    if (driver) {
      try {
        await driver.quit();
      } catch (err) {/* ignore */}
    }
    return res.status(500).send("An error occurred during scraping and booking.");
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);

});
