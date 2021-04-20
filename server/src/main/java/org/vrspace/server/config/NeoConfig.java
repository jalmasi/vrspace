package org.vrspace.server.config;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

import org.neo4j.ogm.config.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Neo4J configuration. Uses embedded database by default, stored under the
 * server directory.
 * 
 * @author joe
 *
 */
@Slf4j
@Component
public class NeoConfig {
  @Value("${spring.data.neo4j.uri:default}")
  private String neoUri;
  @Value("${spring.data.neo4j.auto-index:update}")
  private String neoAutoIndex;
  @Value("${spring.data.neo4j.username:N/A}")
  private String neoUser;
  @Value("${spring.data.neo4j.password:N/A}")
  private String neoPassword;

  @Bean
  public Configuration config() throws URISyntaxException, IOException {
    String path = neoUri;
    Configuration.Builder builder = new Configuration.Builder();
    if (!"default".equals(path)) {
      log.info("Configured database uri: " + path);
      path = path.replace('\\', '/');
      URI uri = new URI(path);
      if ("file".equals(uri.getScheme())) {
        File file = new File(uri.getSchemeSpecificPart());
        path = "file:///" + file.getCanonicalFile().getAbsolutePath().replace('\\', '/');
        log.info("Absolute database path: " + path);
      }
      builder.uri(path);
    }
    builder.autoIndex(neoAutoIndex);
    if (!"N/A".equals(neoUser)) {
      builder.credentials(neoUser, neoPassword);
    }
    return builder.build();
  }
}
