package org.vrspace.server.config;

import java.time.Duration;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;
import javax.servlet.http.HttpSessionEvent;
import javax.servlet.http.HttpSessionListener;

import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.web.servlet.ServletListenerRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.github.bonigarcia.wdm.WebDriverManager;
import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
@WebListener
public class SeleniumConfig implements HttpSessionListener, ServletContextListener {

  private static ConcurrentHashMap<WebSession, WebSession> sessions = new ConcurrentHashMap<>();

  public class WindowStatus {
    public Integer depth = 0;
    public Integer maxDepth = 0;
    public Integer x = 0;
    public Integer y = 0;

    public void increaseDepth() {
      depth++;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }

    public void decreaseDepth() {
      if (depth > 0) {
        depth--;
      }
    }
  }

  // TODO this needs to be some service
  public class WebSession {
    public static final String KEY = "webDriver";
    public WebDriver webDriver;
    public String currentTab;
    public Map<String, WindowStatus> tabs = new ConcurrentHashMap<>();

    public WebSession() {
      log.debug("Creating new firefox instance");
      FirefoxOptions options = new FirefoxOptions();
      // options.setHeadless(true);
      options.addArguments("-headless");
      webDriver = new FirefoxDriver(options);
      int offset = 1024 - 939;
      webDriver.manage().window().setSize(new Dimension(2048, 1024 + offset));
      currentTab = webDriver.getWindowHandle();
      select(currentTab);
      sessions.put(this, this);
    }

    public int close() {
      tabs.remove(currentTab);
      webDriver.close();
      if (tabs.size() > 0) {
        switchTab();
      }
      return tabs.size();
    }

    public void quit() {
      log.debug("Destroying a web driver");
      sessions.remove(this);
      webDriver.quit();
    }

    public WindowStatus status() {
      return tabs.get(currentTab);
    }

    public void switchTab() {
      String[] handles = webDriver.getWindowHandles().toArray(new String[0]);
      String tabHandle = handles[handles.length - 1];
      select(tabHandle);
      webDriver.switchTo().window(tabHandle);
    }

    public void select(String windowHandle) {
      WindowStatus status = tabs.get(windowHandle);
      if (status == null) {
        tabs.put(windowHandle, new WindowStatus());
      }
      currentTab = windowHandle;
    }

    public void action() {
      WindowStatus status = tabs.get(currentTab);
      status.increaseDepth();
    }

    public void back() {
      WindowStatus status = tabs.get(currentTab);
      status.decreaseDepth();
    }

    public int activeTabs() {
      return webDriver.getWindowHandles().size();
    }

    public Integer size() {
      return tabs.size();
    }

    public WebElement click(int x, int y) {
      JavascriptExecutor jse = (JavascriptExecutor) webDriver;
      WebElement clickedElement = (WebElement) jse
          .executeScript("return document.elementFromPoint(arguments[0], arguments[1])", x, y);

      WindowStatus status = tabs.get(currentTab);
      status.x = x;
      status.y = y;
      PointerInput mouse = new PointerInput(PointerInput.Kind.MOUSE, "default mouse");
      Sequence actions = new Sequence(mouse, 0)
          .addAction(mouse.createPointerMove(Duration.ZERO, PointerInput.Origin.viewport(), x, y))
          .addAction(mouse.createPointerDown(PointerInput.MouseButton.LEFT.asArg()))
          .addAction(mouse.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));

      ((RemoteWebDriver) webDriver).perform(Collections.singletonList(actions));

      return clickedElement;
    }
  }

  public class WebSessionFactory {
    public WebSession newSession() {
      WebSession ret = new WebSession();
      return ret;
    }
  }

  @Override
  public void sessionDestroyed(HttpSessionEvent se) {
    log.debug("Session destroyed");
    WebSession session = (WebSession) se.getSession().getAttribute(WebSession.KEY);
    if (session != null) {
      session.quit();
    }
  };

  @Bean
  @ConditionalOnProperty(prefix = "org.vrspace.server", name = "selenium-enabled", havingValue = "true")
  WebSessionFactory factory() {
    log.warn("Enabling remote browsing - security risk");
    WebDriverManager.firefoxdriver().setup();
    return new WebSessionFactory();
  }

  /**
   * Add listener to servlet context, to quit existing web driver instance when
   * the session is destroyed.
   */
  @Bean
  ServletListenerRegistrationBean<HttpSessionListener> sessionListener() {
    // https://stackoverflow.com/questions/32739957/httpsessionlistener-doesnt-work
    log.info("Servlet context initialized, installing web garbage collector");
    return new ServletListenerRegistrationBean<HttpSessionListener>(this);
  }

  /**
   * Clean up active browser processes on shutdown
   */
  @Override
  public void contextDestroyed(ServletContextEvent sce) {
    log.debug("ServletContext destroyed, cleaning up " + sessions.size() + " web sessions");
    sessions.keySet().forEach(e -> e.quit());
  }

}
