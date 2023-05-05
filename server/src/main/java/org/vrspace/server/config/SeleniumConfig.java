package org.vrspace.server.config;

import java.util.concurrent.ConcurrentHashMap;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;
import javax.servlet.http.HttpSessionEvent;
import javax.servlet.http.HttpSessionListener;

import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;
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

  public class WebSession {
    public static final String KEY = "webDriver";
    public WebDriver webDriver;
    public String windowHandle;
    public int mouseX = 0;
    public int mouseY = 0;

    public WebSession() {
      log.debug("Creating new firefox instance");
      FirefoxOptions options = new FirefoxOptions();
      options.setHeadless(true);
      webDriver = new FirefoxDriver(options);
      int offset = 1024 - 939;
      webDriver.manage().window().setSize(new Dimension(2048, 1024 + offset));
      sessions.put(this, this);
    }

    public void close() {
      log.debug("Destroying a web driver");
      webDriver.quit();
      sessions.remove(this);
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
      session.close();
    }
  };

  @Bean
  WebSessionFactory factory() {
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
    sessions.keySet().forEach(e -> e.close());
  }

}
