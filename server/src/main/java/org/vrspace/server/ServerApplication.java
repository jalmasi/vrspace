package org.vrspace.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.context.ConfigurableApplicationContext;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import lombok.extern.slf4j.Slf4j;

/**
 * Main application
 * 
 * @author joe
 *
 */
@SpringBootApplication
@ServletComponentScan
@Slf4j
public class ServerApplication implements ServletContextListener {
  private static ConfigurableApplicationContext ctx;

  public static void main(String[] args) {
    ctx = SpringApplication.run(ServerApplication.class, args);
  }

  @Override
  public void contextDestroyed(ServletContextEvent context) {
    log.info("VRSpace servlet context destroyed");
    // stop the application when tomcat tells it to stop
    if (ctx != null) {
      // context is null if app fails to start
      ctx.stop();
    }
  }

  @Override
  public void contextInitialized(ServletContextEvent sce) {
    log.info("VRSpace servlet context initialized, starting components");
  }
}