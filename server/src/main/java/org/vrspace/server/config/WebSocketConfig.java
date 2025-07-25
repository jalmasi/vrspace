package org.vrspace.server.config;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;
import org.vrspace.server.core.ServerSessionManager;
import org.vrspace.server.core.SessionManager;

import jakarta.servlet.http.HttpSession;

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
  @Value("${org.vrspace.server.websocketSessions:#{true}}")
  private boolean createSession;

  @Autowired
  private SessionManager sessionManager;
  @Autowired
  private ServerSessionManager serverSessionManager;

  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
    // setAllowedOrigins or 403 forbidden when behind proxy
    registry.addHandler(sessionManager, clientPath).setAllowedOrigins(origins)
        .addInterceptors(new CustomSessionHandshakeInterceptor());
    registry.addHandler(serverSessionManager, serverPath).setAllowedOrigins(origins)
        .addInterceptors(new CustomSessionHandshakeInterceptor());
  }

  public class CustomSessionHandshakeInterceptor extends HttpSessionHandshakeInterceptor {
    public static final String HTTP_SESSION_ATTR_NAME = "HTTP.SESSION";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
        Map<String, Object> attributes) throws Exception {
      boolean ret = super.beforeHandshake(request, response, wsHandler, attributes);
      if (request instanceof ServletServerHttpRequest) {
        ServletServerHttpRequest serverRequest = (ServletServerHttpRequest) request;
        HttpSession httpSession = serverRequest.getServletRequest().getSession(isCreateSession());
        attributes.put(HTTP_SESSION_ATTR_NAME, httpSession);
        return httpSession != null;
      }
      return ret;
    }

    /**
     * We allow websocket-only sessions explicitly. Changing this to false disables
     * automatic websocket reconnect, since HTTP request has to be made first to
     * create the session.
     */
    @Override
    public boolean isCreateSession() {
      return createSession;
    }
  }

}