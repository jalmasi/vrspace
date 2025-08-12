package org.vrspace.server.core;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import lombok.extern.slf4j.Slf4j;

/**
 * Keeps track all WebSocket sessions.
 * 
 * @author joe
 *
 */
@Component
@Slf4j
public class SessionManager extends TextWebSocketHandler implements Runnable, HttpSessionListener {
  // TODO: properties
  public static final int SEND_TIMEOUT = 1000;
  // public static final int BUFFER_SIZE = 64 * 1024;
  // enough for up to 1000 clients seeing each other:
  public static final int BUFFER_SIZE = 256 * 1024;
  public static final int PING_PERIOD = 10000;

  private ConcurrentHashMap<String, Client> sessions = new ConcurrentHashMap<String, Client>();
  private ConcurrentHashMap<String, Client> clients = new ConcurrentHashMap<String, Client>();
  private ScheduledExecutorService pingScheduler = Executors.newSingleThreadScheduledExecutor();
  private volatile ScheduledFuture<?> pingFuture;

  @Autowired(required = false)
  private List<SessionListener> sessionListeners;

  @Autowired
  private WorldManager worldManager;
  @Autowired
  @Qualifier("privateMapper")
  private ObjectMapper mapper;

  @PostConstruct
  public void setup() {
    if (sessionListeners == null) {
      sessionListeners = new ArrayList<>(0);
    }
  }

  @Override
  public void handleTextMessage(WebSocketSession session, TextMessage message) {
    Client client = sessions.get(session.getId());
    if (client == null) {
      throw new IllegalStateException("Uknown client for session " + session.getId());
    }
    String payload = message.getPayload();
    try {
      ClientRequest req = mapper.readValue(payload, ClientRequest.class);
      req.setPayload(payload);
      log.debug("Request: " + req);
      req.setClient(client);
      worldManager.dispatch(req);
      sessionListeners.forEach(l -> l.success(req));
    } catch (SessionException e) {
      log.error("Closing session due to fatal error processing message from client " + client.getId() + ":"
          + message.getPayload(), e);
      client.sendMessage(error(e));
      close(session);
      sessionListeners.forEach(l -> l.failure(client, payload, e));
    } catch (Exception e) {
      log.error("Error processing message from client " + client.getId() + ":" + payload, e);
      client.sendMessage(error(e));
      sessionListeners.forEach(l -> l.failure(client, payload, e));
    } catch (Throwable t) {
      log.error("FATAL error", t);
      sessionListeners.forEach(l -> l.failure(client, payload, t));
    }
  }

  public void notifyListeners(VREvent event) {
    this.sessionListeners.forEach(l -> l.event(event));
  }

  private void close(WebSocketSession session) {
    try {
      session.close();
    } catch (IOException ioe) {
      log.error("Unexpected error", ioe);
    }
  }

  private Map<String, String> error(Exception e) {
    // TODO error object: jackson exceptions embed json string, so this error can't
    // always be deserialized on client side
    Map<String, String> ret = new HashMap<String, String>(1);
    ret.put("ERROR", e.toString());
    return ret;
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) {
    try {
      ConcurrentWebSocketSessionDecorator socket = new ConcurrentWebSocketSessionDecorator(session, SEND_TIMEOUT,
          BUFFER_SIZE);
      Welcome welcome = login(socket);
      sessions.put(session.getId(), welcome.getClient());
      clients.put(welcome.getClient().getId(), welcome.getClient());
      welcome.getClient().sendMessage(welcome);
      // welcome.getClient().getScene().update(); // CHECKME: send right away?
      log.info("New session: " + session.getId() + " on " + session.getLocalAddress() + " from "
          + session.getRemoteAddress() + " user " + session.getPrincipal() + " sessions active " + sessions.size());
      if (pingFuture == null) {
        pingFuture = pingScheduler.scheduleAtFixedRate(this, PING_PERIOD, PING_PERIOD, TimeUnit.MILLISECONDS);
      }
      sessionListeners.forEach(l -> l.login(welcome.getClient()));
    } catch (SecurityException se) {
      try {
        // this may be too verbose
        log.error("Invalid login from session " + session.getId() + "/" + session.getRemoteAddress(), se);
        // log.error("Invalid login from session " + session.getId() + "/" +
        // session.getRemoteAddress() + " - " + se);
        session.sendMessage(new TextMessage(mapper.writeValueAsString(error(se))));
        close(session);
      } catch (IOException e) {
        log.error("Unexpected error ", e);
      }
    }
  }

  protected Welcome login(ConcurrentWebSocketSessionDecorator socket) {
    Welcome welcome = worldManager.login(socket);
    return welcome;
  }

  public void run() {
    sessions.forEach((id, client) -> {
      try {
        client.getSession().sendMessage(new PingMessage());
      } catch (IOException e) {
        log.error("Failed pinging " + client.getSession() + " - " + e);
      }
    });
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    Client client = sessions.remove(session.getId());
    if (client != null && client.getId() != null) {
      // may be null in case of authentication failure
      // CHECKME this may be a memory leak
      clients.remove(client.getId());
      log.info("Session closed: " + session.getId() + " on " + session.getLocalAddress() + " from "
          + session.getRemoteAddress() + " user " + session.getPrincipal() + " reason " + status
          + " remaining sessions " + sessions.size());
      worldManager.logout(client);
      sessionListeners.forEach(l -> l.logout(client));
    }
  }

  public Client getClient(String id) {
    return clients.get(id);
  }

  @Override
  public void handlePongMessage(WebSocketSession session, PongMessage message) {
    // log.debug("Pong received from " + session);
  }

  // @Override
  // public void handleTransportError(WebSocketSession session, Throwable
  // exception) {
  // log.error("Websocket error", exception);
  // CHECKME cleanup? Seems that afterConnectionClosed triggers just fine.
  // }

  private void closeSocket(Client client, CloseStatus status) {
    WebSocketSession session = client.getSession();
    try {
      log.info("Closing client websocket " + client.getId() + " status: " + status);
      // this status code is not propagated to the client, always gets 1006 abnormal
      // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
      // triggers afterConnectionClosed that logs out the client
      session.close(status);
    } catch (Exception e) {
      log.error("WebSocket close failure", e);
    }
  }

  @PreDestroy
  public void cleanup() {
    // this is to delete automatically created guest clients on shutdown
    for (Client client : clients.values()) {
      closeSocket(client, CloseStatus.SERVICE_RESTARTED);
    }
  }

  @Override
  public void sessionDestroyed(HttpSessionEvent se) {
    String sessionId = se.getSession().getId();
    String clientId = (String) se.getSession().getAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE);
    log.info("Session destroyed: " + sessionId + " client " + clientId);
    if (clientId != null) {
      Client client = clients.get(clientId);
      if (client == null) {
        log.debug("No client for destroyed session " + sessionId);
      } else {
        closeSocket(client, CloseStatus.POLICY_VIOLATION);
      }
    }
  };

}
