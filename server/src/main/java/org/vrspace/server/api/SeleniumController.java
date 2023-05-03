package org.vrspace.server.api;

import java.io.File;
import java.io.IOException;

import javax.servlet.http.HttpSession;

import org.apache.commons.io.FileUtils;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.SeleniumConfig.WebBrowserFactory;

import lombok.extern.slf4j.Slf4j;

/**
 * Remote browser support. Receives basic commands, forwards them to the
 * headless browser, creates and returns the screenshot.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping("/webbrowser")
public class SeleniumController {
  @Autowired
  WebBrowserFactory factory;

  @GetMapping(value = "/get", produces = MediaType.IMAGE_PNG_VALUE)
  public @ResponseBody byte[] get(String url, HttpSession session) {
    log.debug("Browser getting " + url);
    driver(session).get(url);
    return screenshot(session);
  }

  private byte[] screenshot(HttpSession session) {
    wait(session);
    log.debug("Browser taking screenshot");
    byte[] ret;
    try {
      File scrFile = ((TakesScreenshot) driver(session)).getScreenshotAs(OutputType.FILE);
      // FileUtils.copyToDirectory(scrFile, new File("c:\\tmp\\"));
      ret = FileUtils.readFileToByteArray(scrFile);
    } catch (IOException e) {
      throw new ApiException("Can't read screenshot file: " + e);
    }
    return ret;
  }

  private void wait(HttpSession session) {
    WebDriverWait wait = new WebDriverWait(driver(session), 10);
    wait.until(driver -> ((JavascriptExecutor) driver).executeScript("return document.readyState").equals("complete"));
  }

  private WebDriver driver(HttpSession session) {
    WebDriver ret = getDriver(session);
    if (ret == null) {
      ret = factory.getInstance();
      session.setAttribute("webDriver", ret);
    }
    return ret;
  }

  private WebDriver getDriver(HttpSession session) {
    return (WebDriver) session.getAttribute("webDriver");
  }

}
