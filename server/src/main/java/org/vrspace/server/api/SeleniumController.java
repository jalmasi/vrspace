package org.vrspace.server.api;

import java.io.File;
import java.io.IOException;

import javax.servlet.http.HttpSession;

import org.apache.commons.io.FileUtils;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.SeleniumConfig.WebSession;
import org.vrspace.server.config.SeleniumConfig.WebSessionFactory;

import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
  WebSessionFactory factory;

  @GetMapping(value = "/get", produces = MediaType.IMAGE_PNG_VALUE)
  public @ResponseBody byte[] get(String url, HttpSession session) {
    log.debug("Browser getting " + url);
    WebSession webSession = session(session);
    webSession.webDriver.get(url);
    webSession.windowHandle = webSession.webDriver.getWindowHandle();
    return screenshot(webSession.webDriver);
  }

  @GetMapping(value = "/click", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  public byte[] click(int x, int y, HttpSession session) {
    log.debug("Click on " + x + "," + y);
    WebSession webSession = session(session);
    Actions builder = new Actions(webSession.webDriver);

    // due to lack of moveTo(x,y) method,
    int xOffset = x - webSession.mouseX;
    int yOffset = y - webSession.mouseY;

    builder.moveByOffset(xOffset, yOffset);

    webSession.mouseX = x;
    webSession.mouseY = y;

    builder.click().build().perform();
    wait(webSession.webDriver);
    switchTab(webSession);
    return screenshot(webSession.webDriver);
  }

  @GetMapping(value = "/scroll", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  public byte[] scroll(int pixels, HttpSession session) {
    log.debug("Scroll " + pixels);
    WebSession webSession = session(session);

    JavascriptExecutor jse = (JavascriptExecutor) webSession.webDriver;
    jse.executeScript("window.scrollBy(0," + pixels + ")");

    return screenshot(webSession.webDriver);
  }

  @GetMapping(value = "/close", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  @ApiResponses({
      @ApiResponse(responseCode = "200", description = "Closed a window and switched to previous one, returns screenshot"),
      @ApiResponse(responseCode = "204", description = "Closed last available window, no content") })
  public ResponseEntity<byte[]> close(HttpSession session) {
    log.debug("Close window");
    WebSession webSession = session(session);

    if (webSession.webDriver.getWindowHandles().size() > 1) {
      webSession.webDriver.close();
      switchTab(webSession);
    } else {
      webSession.close();
      session.removeAttribute(WebSession.KEY);
      ResponseEntity<byte[]> empty = new ResponseEntity<>(HttpStatus.NO_CONTENT);
      return empty;
    }

    return new ResponseEntity<byte[]>(screenshot(webSession.webDriver), HttpStatus.OK);
  }

  private void switchTab(WebSession webSession) {
    String[] handles = webSession.webDriver.getWindowHandles().toArray(new String[0]);
    webSession.webDriver.switchTo().window(handles[handles.length - 1]);
  }

  private byte[] screenshot(WebDriver driver) {
    wait(driver);
    log.debug("Browser taking screenshot");
    byte[] ret;
    try {
      File scrFile = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
      // FileUtils.copyToDirectory(scrFile, new File("c:\\tmp\\"));
      ret = FileUtils.readFileToByteArray(scrFile);
    } catch (IOException e) {
      throw new ApiException("Can't read screenshot file: " + e);
    }
    return ret;
  }

  private void wait(WebDriver webDriver) {
    WebDriverWait wait = new WebDriverWait(webDriver, 10);
    wait.until(driver -> ((JavascriptExecutor) driver).executeScript("return document.readyState").equals("complete"));
  }

  private WebSession session(HttpSession session) {
    WebSession ret = (WebSession) session.getAttribute(WebSession.KEY);
    if (ret == null) {
      ret = factory.newSession();
      session.setAttribute("webDriver", ret);
    }
    return ret;
  }

}
