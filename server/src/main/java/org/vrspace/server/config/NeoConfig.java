package org.vrspace.server.config;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

import org.neo4j.ogm.config.Configuration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class NeoConfig {
  @Autowired
  ServerConfig config;

  @Bean
  public Configuration config() throws URISyntaxException, IOException {
    String path = config.getNeoUri();
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
    builder.autoIndex(config.getNeoAutoIndex());
    if (!"N/A".equals(config.getNeoUser())) {
      builder.credentials(config.getNeoUser(), config.getNeoPassword());
    }
    return builder.build();
  }
}
