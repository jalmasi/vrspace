package org.vrspace.server.config;

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
public class SeleniumConfig implements HttpSessionListener {

  public class WebBrowserFactory {
    public WebDriver getInstance() {
      log.debug("Creating new firefox instance");
      FirefoxOptions options = new FirefoxOptions();
      options.setHeadless(true);
      WebDriver driver = new FirefoxDriver(options);
      int offset = 1024 - 939;
      driver.manage().window().setSize(new Dimension(2048, 1024 + offset));
      return driver;
    }
  }

  @Override
  public void sessionDestroyed(HttpSessionEvent se) {
    log.debug("Session destroyed");
    WebDriver webDriver = (WebDriver) se.getSession().getAttribute("webDriver");
    if (webDriver != null) {
      log.debug("Destroying a web driver");
      webDriver.quit();
    }
  };

  @Bean
  WebBrowserFactory factory() {
    WebDriverManager.firefoxdriver().setup();
    return new WebBrowserFactory();
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

}
