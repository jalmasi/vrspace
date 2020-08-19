package org.vrspace.server;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Adds static content to Spring resource path, and makes sure it's not cached.
 * TODO: paths should be configurable
 */
@Configuration
public class ContentConfiguration implements WebMvcConfigurer {
  private static final Log LOG = LogFactory.getLog(ServerApplication.class);

  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    String className = ContentConfiguration.class.getName().replace(".", "/") + ".class";
    URL classUrl = ContentConfiguration.class.getClassLoader().getResource(className);
    LOG.debug("Location of " + className + ":" + classUrl);

    String path = classUrl.getPath();
    int pos = path.indexOf("server/target/classes");
    if (pos > 0) {
      String projectPath = "file://" + path.substring(0, pos);
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
      LOG.error("Invalid content url", mue);
    } catch (IOException ioe) {
      LOG.error("Non-existing directory", ioe);
    }
  }
}
