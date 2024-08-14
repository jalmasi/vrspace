package org.vrspace.server.core;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.openvidu.java.client.Connection;
import io.openvidu.java.client.ConnectionProperties;
import io.openvidu.java.client.ConnectionType;
import io.openvidu.java.client.OpenVidu;
import io.openvidu.java.client.OpenViduException;
import io.openvidu.java.client.OpenViduHttpException;
import io.openvidu.java.client.OpenViduRole;
import io.openvidu.java.client.Session;
import io.openvidu.java.client.SessionProperties;
import lombok.Data;
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
  public static final String mainConnectionId = "OpenViduMain";
  public static final String additionalConnectionId = "OpenViduScreen";

  @Value("#{systemProperties['openvidu.publicurl'] ?: '${openvidu.publicurl:none}' }")
  private String openViduUrl;

  @Value("#{systemProperties['openvidu.secret'] ?: '${openvidu.secret:none}' }")
  private String openViduSecret;

  @Autowired
  ObjectMapper objectMapper;

  private Map<String, Session> sessions = new ConcurrentHashMap<>();

  /**
   * Attempt to start a session, if it does not exist.
   * 
   * @param name Session name, defaults to world name
   * @return OpenVidu session
   * @throws OpenViduException if create session call fails with anything other
   *                           than 409
   */
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

  /**
   * Create connection to OpenVidu session.
   * 
   * @param session     OpenVidu Session to connect to
   * @param sessionData SessionData serialized to String
   * @return token (URL) of the connection
   * @throws OpenViduException
   */
  private String createConnection(Session session, String sessionData) throws OpenViduException {
    ConnectionProperties connectionProperties = new ConnectionProperties.Builder().type(ConnectionType.WEBRTC)
        .role(OpenViduRole.PUBLISHER).data(sessionData).build();
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

  /**
   * Disconnect a client from a session
   * 
   * @param client      whom to disconnect
   * @param sessionName name of the session/world to disconnect from
   * @throws OpenViduException
   */
  public void disconnect(Client client, String sessionName) throws OpenViduException {
    // client is only connected if it has session token
    if (client.getToken(mainConnectionId) != null && sessionName != null) {
      client.clearToken(mainConnectionId);
      client.clearToken(additionalConnectionId);
      Session session = sessions.get(sessionName);
      if (session != null) {
        session.fetch();
        List<Connection> activeConnections = session.getActiveConnections();
        log.debug(
            "Disconnecting client " + client.getId() + ", current active connections " + activeConnections.size());
        for (Connection connection : activeConnections) {
          if (client.getId().toString().equals(connection.getServerData())) {
            session.forceDisconnect(connection);
            log.debug("Disconnected client " + client.getId() + " from world " + sessionName);
            if (activeConnections.size() <= 1) {
              sessions.remove(sessionName);
              log.info("Removed streaming session " + sessionName);
            }
            // do not stop yet - a client may have multiple connections
            // break;
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
  public void join(Client client) {
    if (!"none".equals(openViduUrl) && !"none".equals(openViduSecret)) {
      try {
        disconnect(client, client.getWorld().getName());
      } catch (OpenViduException e) {
        log.error("Failed to disconnect client " + client, e);
      }
      String sessionName = getSessionName(client.getWorld());
      try {
        Session session = startStreamingSession(sessionName);
        try {
          String token = createConnection(session, sessionData(client, "main"));
          client.setToken(mainConnectionId, token);
          log.debug("Client " + client.getId() + " joined session " + client.getWorld().getName() + " with token " + token);
        } catch (OpenViduException e) {
          log.error("Can't generate OpenVidu token", e);
          // TODO failing here probably means the session is invalid, should we remove it?
        } catch (JsonProcessingException e) {
          log.error("JSON error", e);
        }
      } catch (OpenViduException e) {
        log.error("Can't start streaming session " + sessionName, e);
      }
    }
  }

  private String getSessionName(World world) {
    String sessionName = world.getToken();
    if (sessionName == null) {
      sessionName = world.getName();
    }
    return sessionName;
  }

  /**
   * Add another streaming session (for e.g. screen share). Only one additional
   * session supported so far.
   * 
   * @param client
   * @return null if an error occurred, or streaming is not configured, session
   *         token otherwise
   */
  public String addConnection(Client client) {
    if (!"none".equals(openViduUrl) && !"none".equals(openViduSecret)) {
      String sessionName = getSessionName(client.getWorld());
      try {
        Session session = startStreamingSession(sessionName);
        String token = createConnection(session, sessionData(client, "screen"));
        client.setToken(additionalConnectionId, token);
        log.debug("Client " + client.getId() + " added connection to session " + client.getWorld().getName()
            + " with token " + token);
        return token;
      } catch (OpenViduException e) {
        log.error("Can't generate OpenVidu token", e);
      } catch (JsonProcessingException e) {
        log.error("JSON error", e);
      }
    }
    return null;
  }

  public void closeConection(Client client) {
    if (!"none".equals(openViduUrl) && !"none".equals(openViduSecret)) {
      if (client.getToken(additionalConnectionId) != null) {
        client.clearToken(additionalConnectionId);
        Session session = sessions.get(getSessionName(client.getWorld()));
        if (session != null) {
          try {
            session.fetch();
            List<Connection> activeConnections = session.getActiveConnections();
            log.debug(
                "Disconnecting client " + client.getId() + ", current active connections " + activeConnections.size());
            for (Connection connection : activeConnections) {
              if (client.getId().toString().equals(connection.getServerData())) {
              }
            }
          } catch (Exception e) {
            log.error("Can't close OpenVidu connection for " + client.getId(), e);
          }
        }
      }
    }
  }

  String sessionData(Client client, String type) throws JsonProcessingException {
    SessionData sessionData = new SessionData();
    sessionData.clientId = client.getId();
    sessionData.name = getSessionName(client.getWorld());
    sessionData.type = type;
    return objectMapper.writeValueAsString(sessionData);
  }

  @Data
  public class SessionData {
    private Long clientId;
    private String name;
    private String type;
  }
}
