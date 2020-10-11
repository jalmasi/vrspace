package org.vrspace.server.core;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.annotation.PreDestroy;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class SessionManager extends TextWebSocketHandler {
  private ConcurrentHashMap<String, Client> sessions = new ConcurrentHashMap<String, Client>();
  private ConcurrentHashMap<Long, Client> clients = new ConcurrentHashMap<Long, Client>();

  @Autowired
  private WorldManager worldManager;
  private ObjectMapper mapper = new ObjectMapper();

  @Override
  public void handleTextMessage(WebSocketSession session, TextMessage message) {
    Client client = sessions.get(session.getId());
    if (client == null) {
      throw new IllegalStateException("Uknown client for session " + session.getId());
    }
    try {
      String payload = message.getPayload();
      ClientRequest req = mapper.readValue(payload, ClientRequest.class);
      req.setPayload(payload);
      log.debug("Request: " + req);
      req.setClient(client);
      worldManager.dispatch(req);
    } catch (Exception e) {
      log.error("Error processing message from client " + client.getId() + ":" + message.getPayload(), e);
      client.sendMessage(error(e));
    }
  }

  private Map<String, String> error(Exception e) {
    Map<String, String> ret = new HashMap<String, String>(1);
    ret.put("ERROR", e.toString());
    return ret;
  }

  @Override
  public void afterConnectionEstablished(WebSocketSession session) {
    try {
      Welcome welcome = worldManager.login(session);
      sessions.put(session.getId(), welcome.getClient());
      clients.put(welcome.getClient().getId(), welcome.getClient());
      welcome.getClient().sendMessage(welcome);
      // welcome.getClient().getScene().update(); // CHECKME: send right away?
      log.info("New session: " + session.getId() + " on " + session.getLocalAddress() + " from "
          + session.getRemoteAddress() + " user " + session.getPrincipal() + " sessions active " + sessions.size());
    } catch (SecurityException se) {
      try {
        log.error("Invalid login from session " + session.getId() + "/" + session.getRemoteAddress() + " - " + se);
        session.sendMessage(new TextMessage(mapper.writeValueAsString(error(se))));
        session.close();
      } catch (IOException e) {
        log.error("Unexpected error ", e);
      }
    }
  }

  @Override
  public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
    Client client = sessions.remove(session.getId());
    clients.remove(client.getId());
    log.info("Session closed: " + session.getId() + " on " + session.getLocalAddress() + " from "
        + session.getRemoteAddress() + " user " + session.getPrincipal() + " reason " + status + " remaining sessions "
        + sessions.size());
    worldManager.logout(client);
  }

  public Client getClient(Long id) {
    return clients.get(id);
  }

  @PreDestroy
  public void cleanup() {
    // this is to delete automatically created guest clients on shutdown
    for (Client client : clients.values()) {
      worldManager.logout(client);
    }
  }
}