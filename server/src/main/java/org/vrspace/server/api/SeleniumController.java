package org.vrspace.server.api;

import java.io.File;
import java.io.IOException;
import java.time.Duration;

import javax.servlet.http.HttpSession;

import org.apache.commons.io.FileUtils;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.SeleniumConfig.WebSession;
import org.vrspace.server.config.SeleniumConfig.WebSessionFactory;
import org.vrspace.server.config.ServerConfig;

import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.extern.slf4j.Slf4j;

/**
 * Remote browser support. Receives basic commands, forwards them to the
 * headless browser, creates and returns the screenshot. Screenshots are
 * rendered in 2048x1024 resolution, supposedly optimal to be used as textures.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(SeleniumController.PATH)
@ConditionalOnProperty(prefix = "org.vrspace.server", name = "selenium-enabled", havingValue = "true")
public class SeleniumController extends ApiBase {
  public static final String PATH = API_ROOT + "/webbrowser";
  @Autowired
  WebSessionFactory factory;
  @Autowired
  ServerConfig config;

  /**
   * TODO this needs to be moved in general capabilities controller
   * 
   * @return true if remote browsing is available
   */
  @GetMapping("/available")
  public boolean available(HttpSession session) {
    return config.isSeleniumEnabled();
  }

  /**
   * Get a web page
   * 
   * @param url     web page to browse to
   * @param session provided by spring
   * @return screenshot of the rendered page
   */
  @GetMapping(value = "/get", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  @ApiResponses({ @ApiResponse(responseCode = "200", headers = {
      @Header(name = "history-position", description = "Current position in browser window history: 1"),
      @Header(name = "history-length", description = "Total length of browser window history: 1") }) })
  public ResponseEntity<byte[]> get(String url, HttpSession session) {
    log.debug("Browser getting " + url);
    WebSession webSession = session(session);
    synchronized (webSession) {
      webSession.webDriver.get(url);
      return new ResponseEntity<>(screenshot(webSession.webDriver), makeHeaders(webSession), HttpStatus.OK);
    }
  }

  /**
   * Click on a pixel on the screen. This may do nothing or anything, including
   * opening a new tab.
   * 
   * @param x       position from left
   * @param y       position from top
   * @param session provided by spring
   * @return screenshot of the rendered page
   */
  @GetMapping(value = "/click", produces = MediaType.IMAGE_PNG_VALUE)
  @ApiResponses({ @ApiResponse(responseCode = "200", description = "Clicked, returns screenshot", headers = {
      @Header(name = "browser-windows", description = "Number of open browser windows/tabs"),
      @Header(name = "clicked-element", description = "Tag of the element clicked on"),
      @Header(name = "active-element", description = "Tag of the active element after performing the click"),
      @Header(name = "history-position", description = "Current position in browser window history"),
      @Header(name = "history-length", description = "Total length of browser window history") }) })
  @ResponseBody
  public ResponseEntity<byte[]> click(int x, int y, HttpSession session) {
    log.debug("click:" + x + "," + y);
    WebSession webSession = session(session);
    synchronized (webSession) {
      int numTabs = webSession.activeTabs();

      JavascriptExecutor jse = (JavascriptExecutor) webSession.webDriver;
      String clickedTag = null;
      String location = (String) jse.executeScript("return window.location.href");

      WebElement clickedElement = webSession.click(x, y);
      if (clickedElement != null && clickedElement.isEnabled()) {
        clickedTag = clickedElement.getTagName();
      }

      wait(webSession.webDriver);
      if (numTabs < webSession.activeTabs()) {
        // new tab has opened
        log.debug("new window");
        webSession.switchTab();
      } else if ("a".equals(clickedTag) || "iframe".equals(clickedTag)) {
        // link clicked, assume location changed
        webSession.action();
      } else {
        String newLoc = (String) jse.executeScript("return window.location.href");
        log.debug("Action, location: " + location + " -> " + newLoc + " changed " + !location.equals(newLoc));
        // another action in this tab
        if (!location.equals(newLoc)) {
          webSession.action();
        }
      }

      HttpHeaders headers = makeHeaders(webSession);
      ResponseEntity<byte[]> ret = new ResponseEntity<>(screenshot(webSession.webDriver), headers, HttpStatus.OK);

      WebElement activeElement = webSession.webDriver.switchTo().activeElement();
      log.debug("Clicked element: " + clickedTag);
      log.debug("Active element: " + activeElement.getTagName());
      headers.add("clicked-element", clickedTag);
      headers.add("active-element", activeElement.getTagName());

      return ret;
    }
  }

  private HttpHeaders makeHeaders(WebSession webSession) {
    HttpHeaders headers = new HttpHeaders();
    headers.add("history-position", webSession.status().depth.toString());
    headers.add("history-length", webSession.status().maxDepth.toString());
    headers.add("browser-windows", webSession.size().toString());
    return headers;
  }

  /**
   * Scroll up or down by given number of pixels.
   * 
   * @param pixels  positive down, or negative up
   * @param session provided by spring
   * @return screenshot of the page
   */
  @GetMapping(value = "/scroll", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  public byte[] scroll(int pixels, HttpSession session) {
    log.debug("Scroll " + pixels);
    WebSession webSession = session(session);
    synchronized (webSession) {
      JavascriptExecutor jse = (JavascriptExecutor) webSession.webDriver;
      jse.executeScript("window.scrollBy(0," + pixels + ")");

      return screenshot(webSession.webDriver);
    }
  }

  /**
   * Close the browser window/tab. Returns to previous tab if any, or returns no
   * content (http 204 status).
   * 
   * @param session provided by spring
   * @return screenshot, may be empty if the browser was closed.
   */
  @GetMapping(value = "/close", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  @ApiResponses({
      @ApiResponse(responseCode = "200", description = "Closed a window and switched to previous one, returns screenshot", headers = {
          @Header(name = "browser-windows", description = "Number of open browser windows/tabs") }),
      @ApiResponse(responseCode = "204", description = "Closed last available window, no content") })
  public ResponseEntity<byte[]> close(HttpSession session) {
    log.debug("Close window");
    WebSession webSession = session(session);

    synchronized (webSession) {
      if (webSession.close() == 0) {
        session.removeAttribute(WebSession.KEY);
        ResponseEntity<byte[]> empty = new ResponseEntity<>(HttpStatus.NO_CONTENT);
        return empty;
      }

      return new ResponseEntity<byte[]>(screenshot(webSession.webDriver), makeHeaders(webSession), HttpStatus.OK);
    }
  }

  /**
   * Quit current browser
   */
  @GetMapping(value = "/quit")
  public void quit(HttpSession session) {
    WebSession ret = (WebSession) session.getAttribute(WebSession.KEY);
    if (ret != null) {
      ret.webDriver.quit();
      session.removeAttribute(WebSession.KEY);
    }
  }

  /**
   * Navigate back
   */
  @GetMapping(value = "/back", produces = MediaType.IMAGE_PNG_VALUE)
  @ApiResponses({
      @ApiResponse(responseCode = "200", description = "Went back, returns screenshot", headers = {
          @Header(name = "browser-windows", description = "Number of open browser windows/tabs"),
          @Header(name = "history-position", description = "Current position in browser window history"),
          @Header(name = "history-length", description = "Total length of browser window history") }),
      @ApiResponse(responseCode = "204", description = "Closed last window") })
  @ResponseBody
  public ResponseEntity<byte[]> back(HttpSession session) {
    log.debug("back");
    WebSession webSession = session(session);
    synchronized (webSession) {
      if (webSession.status().depth > 0) {
        log.debug("navigating back");
        // webSession.webDriver.navigate().back(); // apparently this hangs
        ((JavascriptExecutor) webSession.webDriver).executeScript("history.back()");
        webSession.back();
      } else if (webSession.activeTabs() > 1) {
        // can't go back, close the tab
        log.debug("Last action, closing window");
        webSession.close();
      } else {
        log.debug("last window, last action");
        webSession.close();
        session.removeAttribute(WebSession.KEY);
        ResponseEntity<byte[]> empty = new ResponseEntity<>(HttpStatus.NO_CONTENT);
        return empty;
      }
      return new ResponseEntity<>(screenshot(webSession.webDriver), makeHeaders(webSession), HttpStatus.OK);
    }
  }

  /**
   * Navigate forward
   */
  @GetMapping(value = "/forward", produces = MediaType.IMAGE_PNG_VALUE)
  @ApiResponses({ @ApiResponse(responseCode = "200", description = "Went forward, returns screenshot", headers = {
      @Header(name = "browser-windows", description = "Number of open browser windows/tabs"),
      @Header(name = "history-position", description = "Current position in browser window history"),
      @Header(name = "history-length", description = "Total length of browser window history") }) })
  @ResponseBody
  public ResponseEntity<byte[]> forward(HttpSession session) {
    log.debug("forward");
    WebSession webSession = session(session);
    synchronized (webSession) {
      if (webSession.status().depth < webSession.status().maxDepth) {
        webSession.action();
      }
      // webSession.webDriver.navigate().forward(); // may hang
      ((JavascriptExecutor) webSession.webDriver).executeScript("history.forward()");
      return new ResponseEntity<>(screenshot(webSession.webDriver), makeHeaders(webSession), HttpStatus.OK);
    }
  }

  @GetMapping(value = "/enter", produces = MediaType.IMAGE_PNG_VALUE)
  @ResponseBody
  public ResponseEntity<byte[]> enter(String text, HttpSession session) {
    WebSession webSession = session(session);
    synchronized (webSession) {
      JavascriptExecutor jse = (JavascriptExecutor) webSession.webDriver;

      WebElement inputElement = (WebElement) jse.executeScript(
          "return document.elementFromPoint(arguments[0], arguments[1])", webSession.status().x, webSession.status().y);
      inputElement.sendKeys(text);
      inputElement.submit();
      return new ResponseEntity<>(screenshot(webSession.webDriver), makeHeaders(webSession), HttpStatus.OK);
    }
  }

  private byte[] screenshot(WebDriver driver) {
    wait(driver);
    log.debug("Browser taking screenshot");
    byte[] ret;
    try {
      File scrFile = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
      ret = FileUtils.readFileToByteArray(scrFile);
    } catch (IOException e) {
      throw new ApiException("Can't read screenshot file: " + e);
    }
    return ret;
  }

  private void wait(WebDriver webDriver) {
    WebDriverWait wait = new WebDriverWait(webDriver, Duration.ofSeconds(10));
    wait.until(driver -> ((JavascriptExecutor) driver).executeScript("return document.readyState").equals("complete"));
    try {
      Thread.sleep(300);
    } catch (InterruptedException e) {
    }
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
