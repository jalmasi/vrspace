package org.vrspace.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Adds static admin UI content to Spring resource path, and makes sure it's not
 * cached. Activated when org.vrspace.adminUI.enabled=true, content served under
 * org.vrspace.adminUI.path.
 */
@Configuration
@ConditionalOnProperty("org.vrspace.adminUI.enabled")
public class AdminUIConfiguration implements WebMvcConfigurer {
  @Value("${org.vrspace.adminUI.path}")
  private String path;

  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry.addResourceHandler(path + "/**").addResourceLocations("classpath:/static/").setCachePeriod(0);
  }

}
