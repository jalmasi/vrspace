package org.vrspace.server.core;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

import io.openvidu.java.client.Connection;
import io.openvidu.java.client.ConnectionProperties;
import io.openvidu.java.client.ConnectionType;
import io.openvidu.java.client.OpenVidu;
import io.openvidu.java.client.OpenViduException;
import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduRole;
import io.openvidu.java.client.Session;
import io.openvidu.java.client.SessionProperties;
import lombok.extern.slf4j.Slf4j;

/**
 * Manages streaming sessions to OpenVidu server.
 * 
 * @author joe
 *
 */
@Component
@Slf4j
public class StreamManager {
  public static final String serviceId = "OpenVidu";

  @Value("#{systemProperties['openvidu.publicurl'] ?: '${openvidu.publicurl:none}' }")
  private String openViduUrl;

  @Value("#{systemProperties['openvidu.secret'] ?: '${openvidu.secret:none}' }")
  private String openViduSecret;

  private Map<String, Session> sessions = new ConcurrentHashMap<>();

  private Session startStreamingSession(String name) throws OpenViduException {
    Session ret = null;
    OpenVidu openVidu = new OpenVidu(openViduUrl, openViduSecret);
    // CHECKME: we can't use anything for the name, this may fail if it contains
    // e.g. spaces or quotes
    SessionProperties properties = new SessionProperties.Builder().customSessionId(name).build();
    try {
      ret = openVidu.createSession(properties);
      sessions.put(name, ret);
      log.info("Created streaming session " + name);
    } catch (OpenViduHttpException e) {
      if (e.getStatus() == 409) {
        // session already exists
        ret = sessions.get(name);
        if (ret == null) {
          // how come we don't know about it then?
          throw e;
        }
      } else {
        throw e;
      }
    }
    return ret;
  }

  private String generateToken(Session session, Client client) throws OpenViduException {
    ConnectionProperties connectionProperties = new ConnectionProperties.Builder().type(ConnectionType.WEBRTC)
        .role(OpenViduRole.PUBLISHER).data(client.getId().toString()).build();
    // token is something like
    // wss://localhost:4443?sessionId=cave&token=tok_W1LlxOQElNQGcSIw&role=PUBLISHER&version=2.15.0
    String token = null;
    try {
      token = session.createConnection(connectionProperties).getToken();
    } catch (OpenViduHttpException e) {
      // 404 here means no session:
      if (e.getStatus() == 404) {
        log.error("Error generating token - session not found. Creating new session", e);
        session = startStreamingSession(session.getSessionId());
        token = session.createConnection(connectionProperties).getToken();
      } else {
        throw e;
      }
    }
    return token;
  }

  public void disconnect(Client client, String worldName) throws OpenViduException {
    // client is only connected if it has session token
    if (client.getToken(serviceId) != null && worldName != null) {
      Session session = sessions.get(worldName);
      if (session != null) {
        session.fetch();
        List<Connection> activeConnections = session.getActiveConnections();
        log.debug(
            "Disconnecting client " + client.getId() + ", current active connections " + activeConnections.size());
        for (Connection connection : activeConnections) {
          if (client.getId().toString().equals(connection.getServerData())) {
            session.forceDisconnect(connection);
            client.clearToken(serviceId);
            log.debug("Disconnected client " + client.getId() + " from world " + worldName);
            if (activeConnections.size() <= 1) {
              sessions.remove(worldName);
              log.info("Removed streaming session " + worldName);
            }
            break;
          }
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
    if (!"none".equals(openViduUrl) && !"none".equals(openViduSecret)) {
      try {
        disconnect(client, world.getName());
      } catch (OpenViduException e) {
        log.error("Failed to disconnect client " + client, e);
      }
      String sessionName = world.getToken();
      if (sessionName == null) {
        sessionName = world.getName();
      }
      try {
        Session session = startStreamingSession(sessionName);
        try {
          String token = generateToken(session, client);
          client.setToken(serviceId, token);
          log.debug("Client " + client.getId() + " joined session " + world.getName() + " with token " + token);
        } catch (OpenViduException e) {
          log.error("Can't generate OpenVidu token", e);
          // TODO failing here probably means the session is invalid, should we remove it?
        }
      } catch (OpenViduException e) {
        log.error("Can't start streaming session " + sessionName, e);
      }
    }
  }

}
