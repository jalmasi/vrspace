package org.vrspace.server.config;

import java.util.HashMap;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.vrspace.server.obj.ServerWorld;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Container for pre-configured worlds, created by WorldManager during startup.
 * Worlds can be configured with org.vrspace.server.WORLDNAME.x properties, most
 * important org.vrspace.server.WORLDNAME.specifies the class that extends World
 * and implements custom enter and exit methods. All other properties are passed
 * to the world instance during creation, intended to be used in World.enter(),
 * WorldController, etc.
 * 
 * @see ServerWorld
 */
@Configuration
@ConfigurationProperties("org.vrspace.server")
@Data
@NoArgsConstructor
public class WorldConfig {
  private Map<String, WorldProperties> world = new HashMap<>();

  @Data
  @NoArgsConstructor
  public static class WorldProperties {
    /**
     * Name of the world class, that extends World and implements custom enter() and
     * exit()
     */
    private String type;
    /** Unique world name */
    private String name;
    private String url;
    private String portalMesh;
    private String portalThumbnail;
    private String portalScript;
    private boolean available;
  }
}
