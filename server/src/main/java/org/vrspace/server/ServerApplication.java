package org.vrspace.server;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletComponentScan;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * Main application
 * 
 * @author joe
 *
 */
@SpringBootApplication
@ServletComponentScan
public class ServerApplication implements ServletContextListener {
  private static ConfigurableApplicationContext ctx;

  public static void main(String[] args) {
    ctx = SpringApplication.run(ServerApplication.class, args);
  }

  @Override
  public void contextDestroyed(ServletContextEvent context) {
    // stop the application when tomcat tells it to stop
    ctx.stop();
  }
}
