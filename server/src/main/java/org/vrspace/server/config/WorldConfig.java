package org.vrspace.server.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.Data;
import lombok.NoArgsConstructor;

@Configuration
@ConfigurationProperties("org.vrspace.server")
@Data
@NoArgsConstructor
public class WorldConfig {
  private Map<String, WorldProperties> world = new HashMap<>();

  @Data
  @NoArgsConstructor
  public static class WorldProperties {
    private String type;
    private String name;
    private String url;
  }
}
