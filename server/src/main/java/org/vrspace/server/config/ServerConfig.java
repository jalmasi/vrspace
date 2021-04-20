package org.vrspace.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.Data;

@Component
@Data
public class ServerConfig {
  @Value("${spring.data.neo4j.uri:default}")
  private String neoUri;
  @Value("${spring.data.neo4j.auto-index:update}")
  private String neoAutoIndex;
  @Value("${spring.data.neo4j.username:N/A}")
  private String neoUser;
  @Value("${spring.data.neo4j.password:N/A}")
  private String neoPassword;

  @Value("${org.vrspace.server.guestAllowed:true}")
  private boolean guestAllowed = true;

  @Value("${org.vrspace.server.createWorlds:true}")
  private boolean createWorlds = true;

  @Value("${org.vrspace.server.sessionStartTimeout:0}")
  private int sessionStartTimeout;

  @Value("${org.vrspace.server.maxSessions:0}")
  private int maxSessions;

}
