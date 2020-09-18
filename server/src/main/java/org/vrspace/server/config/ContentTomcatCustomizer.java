package org.vrspace.server.config;

import java.io.File;

import org.apache.catalina.Context;
import org.apache.catalina.Wrapper;
import org.springframework.boot.web.embedded.tomcat.TomcatContextCustomizer;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.stereotype.Component;
import org.vrspace.server.core.ClassUtil;

/**
 * Adds content and client (babylon) directories to content path, and enables
 * directory listings. TODO: paths should be configurable
 * 
 * @author joe
 *
 */
@Component
public class ContentTomcatCustomizer implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {
  @Override
  public void customize(TomcatServletWebServerFactory factory) {
    String serverDir = ClassUtil.projectHomeDirectory();
    if (serverDir != null) {
      File contentDir = new File(serverDir);
      factory.setDocumentRoot(contentDir);
      factory.setContextPath("");
      factory.addContextCustomizers(new TomcatContextCustomizer() {
        @Override
        public void customize(Context context) {
          Wrapper defServlet = (Wrapper) context.findChild("default");
          defServlet.addInitParameter("listings", "true");
          defServlet.addInitParameter("readOnly", "false");
          defServlet.addInitParameter("debug", "1");
          defServlet.addMapping("/content/*");
          defServlet.addMapping("/babylon/*");
          defServlet.addMapping("/web/*");
        }
      });
    }
  }

}
