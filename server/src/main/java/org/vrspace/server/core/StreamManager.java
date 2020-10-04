package org.vrspace.server.core;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

import io.openvidu.java.client.Connection;
import io.openvidu.java.client.OpenVidu;
import io.openvidu.java.client.OpenViduException;
import io.openvidu.java.client.OpenViduRole;
import io.openvidu.java.client.Session;
import io.openvidu.java.client.SessionProperties;
import io.openvidu.java.client.TokenOptions;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class StreamManager {

  @Value("#{systemProperties['openvidu.publicurl'] ?: '${openvidu.publicurl:none}' }")
  private String openViduUrl;

  @Value("#{systemProperties['openvidu.secret'] ?: '${openvidu.secret:none}' }")
  private String openViduSecret;

  private Map<String, Session> sessions = new HashMap<String, Session>();

  private Session createStreamingSession(String name) throws OpenViduException {
    OpenVidu openVidu = new OpenVidu(openViduUrl, openViduSecret);
    SessionProperties properties = new SessionProperties.Builder().customSessionId(name).build();
    log.info("Created streaming session " + name);
    return openVidu.createSession(properties);
  }

  private String generateToken(Session session, Client client) throws OpenViduException {
    TokenOptions tokenOptions = new TokenOptions.Builder().role(OpenViduRole.PUBLISHER).data(client.getId().toString())
        .build();
    // TODO parse this string and return token
    // wss://localhost:4443?sessionId=cave&token=tok_W1LlxOQElNQGcSIw&role=PUBLISHER&version=2.15.0
    String token = session.generateToken(tokenOptions);
    // String something = session.generateToken(tokenOptions);
    // String token = something.split("&")[1].split("=")[1];
    // 404 here means no session:
    return token;
  }

  private void disconnect(Client client) throws OpenViduException {
    // client is only connected if it has session token
    if (client.getToken() != null) {
      Session session = sessions.get(client.getWorld().getName());
      session.fetch();
      for (Connection connection : session.getActiveConnections()) {
        if (client.getId().toString().equals(connection.getClientData())) {
          session.forceDisconnect(connection);
          client.setToken(null);
          log.debug("Disconnected client " + client.getId() + " from world " + client.getWorld().getName());
          break;
        }
      }
    }
  }

  /**
   * Disconnect a client from an existing session, and create a new session for a
   * world
   * 
   * @param client
   * @param world
   */
  public void join(Client client, World world) {
    if (openViduUrl != null && openViduSecret != null) {
      try {
        disconnect(client);
      } catch (OpenViduException e) {
        log.error("Failed to disconnect client " + client, e);
      }
      Session session = sessions.get(world.getName());
      if (session == null) {
        // the session does not exists yet, create it
        try {
          session = createStreamingSession(world.getName());
          sessions.put(world.getName(), session);
        } catch (OpenViduException e) {
          // TODO failing here may mean that session already exists
          // check for 409 in OpenViduHttpException
          log.error("Can't create OpenVidu session", e);
          return;
        }
      }
      try {
        String token = generateToken(session, client);
        client.setToken(token);
        log.debug("Client " + client.getId() + " joined session " + world.getName() + " with token " + token);
      } catch (OpenViduException e) {
        log.error("Can't generate OpenVidu token", e);
        // TODO failing here probably means the session is invalid, should we remove it?
      }
    }
  }

}
