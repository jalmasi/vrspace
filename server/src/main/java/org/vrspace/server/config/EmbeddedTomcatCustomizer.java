package org.vrspace.server.config;

import java.io.File;

import org.apache.catalina.Context;
import org.apache.catalina.Wrapper;
import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.embedded.tomcat.TomcatConnectorCustomizer;
import org.springframework.boot.web.embedded.tomcat.TomcatContextCustomizer;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.stereotype.Component;
import org.vrspace.server.core.ClassUtil;

import lombok.extern.slf4j.Slf4j;

/**
 * Adds content and client (babylon) directories to content path, and enables
 * directory listings. TODO: paths should be configurable
 * 
 * @author joe
 *
 */
@Component
@Slf4j
public class EmbeddedTomcatCustomizer implements WebServerFactoryCustomizer<TomcatServletWebServerFactory> {
  @Autowired
  private ServerConfig serverConfig;

  @Override
  public void customize(TomcatServletWebServerFactory factory) {
    String serverDir = ClassUtil.projectHomeDirectory();
    if (serverDir == null) {
      log.error("Can't determine project home directory");
    } else {
      File contentDir = new File(serverDir);
      factory.setDocumentRoot(contentDir);
      factory.setContextPath("");
      if (serverConfig.isBehindProxy()) {
        factory.addConnectorCustomizers(new TomcatConnectorCustomizer() {
          @Override
          public void customize(Connector connector) {
            connector.setScheme("https");
            connector.setSecure(true);
          }
        });
      }
      factory.addContextCustomizers(new TomcatContextCustomizer() {
        @Override
        public void customize(Context context) {
          Wrapper defServlet = (Wrapper) context.findChild("default");
          if (defServlet == null) {
            log.info("Server is not serving static content - server.servlet.register-default-servlet disabled");
          } else {
            // FIXME
            defServlet.addInitParameter("listings", "true");
            defServlet.addInitParameter("readOnly", "false");
            defServlet.addInitParameter("debug", "1");
            defServlet.addMapping("/content/*");
            defServlet.addMapping("/babylon/*");
            defServlet.addMapping("/web/*");
          }
        }
      });
    }
  }

}
