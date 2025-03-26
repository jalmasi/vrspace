package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.core.StreamManager;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;

/**
 * Provides information about server capabilities and configuration.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(ServerInfo.PATH)
public class ServerInfo extends ApiBase {
  public static final String PATH = API_ROOT + "/server-info";

  @Autowired
  private ServerConfig config;
  @Autowired(required = false)
  private Oauth2Login oauth2Login;
  @Autowired
  private StreamManager streamManager;
  @Autowired
  private Sketchfab sketchfab;
  @Autowired(required = false)
  private WebPush webPush;
  @Value("${org.vrspace.server.socketPath:/vrspace/client}")
  private String clientPath;
  @Value("${org.vrspace.server.socketPath:/vrspace/server}")
  private String serverPath;
  @Value("${server.servlet.session.timeout:default}")
  private String sessionTimeout;

  @Data
  public static class ServerCapabilities {
    /** Oauth2 authentication is supported, and the endpoint is available */
    private boolean oauth2;
    /** Remote browsing with selenium is supported, and the endpoint is available */
    private boolean remoteBrowser;
    /** The server supports video/audio streaming */
    private boolean streamingMedia;
    /** Download of 3d content from sketchfab is allowed */
    private boolean sketchfab;
    /** Web Push messages for groups and world invitations are configured */
    private boolean webPush;
  }

  @Data
  public static class ServerConfiguration {
    /** Guest (without login) access is allowed */
    private boolean guestAllowed;
    /** Worlds are created on demand */
    private boolean createWorlds;
    /** Maximum concurrent sessions per server, 0 for unlimited */
    private int maxSessions;
    /**
     * Sessions over maxSessions will wait this many seconds to start, 0 for
     * unlimited
     */
    private int sessionStartTimeout;
    /**
     * HTTP session timeout.
     */
    private String sessionTimeout;
    /** WebSocket that clients use to connect */
    private String webSocketClientPath;
    /** WebSocket that other servers use to connect */
    private String webSocketServerPath;
  }

  @Data
  public static class CapabilitiesAndConfig {
    private ServerCapabilities capabilities;
    private ServerConfiguration config;
  }

  @GetMapping
  public CapabilitiesAndConfig getServerInfo() {
    CapabilitiesAndConfig ret = new CapabilitiesAndConfig();
    ret.config = getServerConfig();
    ret.capabilities = getServerCapabilities();
    return ret;
  }

  @GetMapping("/capabilities")
  public ServerCapabilities getServerCapabilities() {
    ServerCapabilities ret = new ServerCapabilities();
    ret.setOauth2(oauth2Login != null);
    ret.setRemoteBrowser(config.isSeleniumEnabled());
    ret.setStreamingMedia(streamManager.isAvailable());
    ret.setSketchfab(sketchfab.isAvailable());
    ret.setWebPush(webPush != null);
    return ret;
  }

  @GetMapping("/configuration")
  public ServerConfiguration getServerConfig() {
    ServerConfiguration ret = new ServerConfiguration();
    ret.setGuestAllowed(config.isGuestAllowed());
    ret.setCreateWorlds(config.isCreateWorlds());
    ret.setMaxSessions(config.getMaxSessions());
    ret.setSessionStartTimeout(config.getSessionStartTimeout());
    ret.setSessionTimeout(sessionTimeout);
    ret.setWebSocketClientPath(clientPath);
    ret.setWebSocketServerPath(serverPath);
    return ret;
  }
}
