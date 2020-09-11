package org.vrspace.server;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;

import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import lombok.extern.slf4j.Slf4j;

/**
 * Adds static content to Spring resource path, and makes sure it's not cached.
 * This is alternative to ContentTomcatCustomizer. TODO: paths should be
 * configurable
 */
//@Configuration
@Slf4j
public class ContentConfiguration implements WebMvcConfigurer {

  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    String serverDir = ClassUtil.projectHomeDirectory();
    if (serverDir != null) {
      String projectPath = "file://" + serverDir;
      // under that there's server, content, babylon (client) subdirs
      addContentPath(projectPath + "babylon/", "/babylon", registry);
      addContentPath(projectPath + "content/", "/content", registry);
    }
  }

  private void addContentPath(String dir, String dest, ResourceHandlerRegistry registry) {
    try {
      URL url = new URL(dir);
      InputStream in = url.openStream();
      in.close();
      registry.addResourceHandler(dest + "/**").addResourceLocations(dir).setCachePeriod(0);
    } catch (MalformedURLException mue) {
      log.error("Invalid content url", mue);
    } catch (IOException ioe) {
      log.error("Non-existing directory", ioe);
    }
  }
}
