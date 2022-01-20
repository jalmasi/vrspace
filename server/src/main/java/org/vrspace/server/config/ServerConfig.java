package org.vrspace.server.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.Data;

/**
 * General server configuration. By default guest users are allowed
 * (guestAllowed:true), new worlds are created on Enter command
 * (createWorlds:true), number of concurrent sessions is unlimited
 * (maxSessions:0), and session start fails immediately if maxSessions is
 * reached (sessionStartTimeout:0)
 * 
 * @author joe
 *
 */
@Component
@Data
public class ServerConfig {

  @Value("${org.vrspace.server.guestAllowed:true}")
  private boolean guestAllowed = true;

  @Value("${org.vrspace.server.createWorlds:true}")
  private boolean createWorlds = true;

  @Value("${org.vrspace.server.maxSessions:0}")
  private int maxSessions;

  @Value("${org.vrspace.server.sessionStartTimeout:0}")
  private int sessionStartTimeout;

  // CHECKME: somewhere else?
  @Value("${org.vrspace.writeback.enabled:true}")
  private volatile boolean writeBackActive = true;

  @Value("${org.vrspace.writeback.delay:1000}")
  private long writeBackDelay = 1000;

  // TODO introduce getters for server directories, e.g. content dir
}
