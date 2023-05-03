package org.vrspace.server;

import java.io.File;

import org.apache.commons.io.FileUtils;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.interactions.Actions;

import io.github.bonigarcia.wdm.WebDriverManager;

public class SeleniumTest {
  WebDriver driver;

  @Test
  public void testSomething() throws Exception {
    // chrome can't screenshot 3d canvas
    // WebDriverManager.chromedriver().setup();
    // WebDriver driver = new ChromeDriver();
    WebDriverManager.firefoxdriver().setup();
    FirefoxOptions options = new FirefoxOptions();
    //options.setHeadless(true);
    driver = new FirefoxDriver(options);
    // browser window is larger than the content by this many pixel rows
    int offset = 1024 - 939;
    driver.manage().window().setSize(new Dimension(2048, 1024 + offset));
    // driver.manage().timeouts().implicitlyWait(10, TimeUnit.SECONDS);
    driver.get("https://www.vrspace.org/");
    String window = driver.getWindowHandle();
    screenshot();

    Actions builder = new Actions(driver);
    builder.moveByOffset(1800, 12);
    builder.click().build().perform();
    Thread.sleep(1000);
    String[] handles = driver.getWindowHandles().toArray(new String[0]);
    driver.switchTo().window(handles[handles.length - 1]);
    screenshot();

    driver.switchTo().window(window);
    JavascriptExecutor jse = (JavascriptExecutor) driver;
    jse.executeScript("window.scrollBy(0,1024)");

    screenshot();

    driver.quit();
  }

  private void screenshot() throws Exception {
    File scrFile = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
    FileUtils.copyToDirectory(scrFile, new File("c:\\tmp\\"));
  }
}
