package org.vrspace.server.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.dto.Welcome;

/**
 * this one manages sessions of connected servers
 * 
 * @author joe
 *
 */
@Component
public class ServerSessionManager extends SessionManager {
  @Autowired
  private WorldManager worldManager;

  @Override
  protected Welcome login(ConcurrentWebSocketSessionDecorator socket) {
    Welcome welcome = worldManager.serverLogin(socket);
    return welcome;
  }
}
