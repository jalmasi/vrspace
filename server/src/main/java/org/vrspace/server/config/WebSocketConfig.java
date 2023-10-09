package org.vrspace.server.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;
import org.vrspace.server.core.ServerSessionManager;
import org.vrspace.server.core.SessionManager;

/**
 * Configures WebSocket path (default:/vrspace) and allowed origins (default:*)
 * 
 * @author joe
 * @see SessionManager
 *
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
  @Value("${org.vrspace.server.socketPath:/vrspace/client}")
  private String clientPath;
  @Value("${org.vrspace.server.socketPath:/vrspace/server}")
  private String serverPath;
  @Value("${org.vrspace.server.allowedOrigins:*}")
  private String origins;

  @Autowired
  private SessionManager sessionManager;
  @Autowired
  private ServerSessionManager serverSessionManager;

  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    // setAllowedOrigins or 403 forbidden when behind proxy
    registry.addHandler(sessionManager, clientPath).setAllowedOrigins(origins)
        .addInterceptors(new HttpSessionHandshakeInterceptor());
    registry.addHandler(serverSessionManager, serverPath).setAllowedOrigins(origins)
        .addInterceptors(new HttpSessionHandshakeInterceptor());
  }
}