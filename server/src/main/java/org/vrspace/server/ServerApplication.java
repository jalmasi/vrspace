package org.vrspace.server;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.neo4j.ogm.config.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ServerApplication {
  private static final Log LOG = LogFactory.getLog(ServerApplication.class);

  @Value("${spring.data.neo4j.uri:default}")
  private String neoUri;
  @Value("${spring.data.neo4j.auto-index:update}")
  private String neoAutoIndex;
  @Value("${spring.data.neo4j.username:N/A}")
  private String neoUser;
  @Value("${spring.data.neo4j.password:N/A}")
  private String neoPassword;

  @Bean
  public Configuration neoConfig() throws URISyntaxException, IOException {
    String path = neoUri;
    Configuration.Builder builder = new Configuration.Builder();
    if (!"default".equals(path)) {
      LOG.info("Configured database uri: " + path);
      path = path.replace('\\', '/');
      URI uri = new URI(path);
      if ("file".equals(uri.getScheme())) {
        File file = new File(uri.getSchemeSpecificPart());
        path = "file:///" + file.getCanonicalFile().getAbsolutePath().replace('\\', '/');
        LOG.info("Absolute database path: " + path);
      }
      builder.uri(path);
    }
    builder.autoIndex(neoAutoIndex);
    if (!"N/A".equals(neoUser)) {
      builder.credentials(neoUser, neoPassword);
    }
    return builder.build();
  }

  public static void main(String[] args) {
    SpringApplication.run(ServerApplication.class, args);
  }

}
