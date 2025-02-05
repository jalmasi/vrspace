package org.vrspace.server.obj;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.core.WriteBack;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.types.Owned;
import org.vrspace.server.types.Private;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * Basic client class, adds user-related properties and business logic to
 * VRObject.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@Owned
@Slf4j
public class Client extends VRObject {
  /**
   * Client name - unique ID.
   */
  // @Index(unique = true) - NeoConfig creates it
  @ToString.Include
  private String name;
  /**
   * User's height in real life, used in VR. Transient biometric data.
   */
  @Transient
  transient private Double userHeight;
  @Private
  @Transient
  transient private SceneProperties sceneProperties;
  /**
   * Scene contains all object that a client tracks, e.g. user sees.
   */
  @JsonIgnore
  @Transient
  transient private Scene scene;
  /**
   * Identity is a big unknown yet, will likely get encapsulated in a class. For
   * the time being, it's something like username@oauth2provider, e.g.
   * joe@facebook
   */
  @Private
  @JsonIgnore
  private String identity;
  /**
   * Tokens used to access video/audio streaming servers, identify conversations
   * with chatbots etc. Transient, never stored to the database.
   */
  @Private
  @Transient
  transient private Map<String, String> tokens = new HashMap<>();
  /**
   * Write-back cache to persist changes to all properties.
   */
  @JsonIgnore
  @Transient
  transient private WriteBack writeBack;
  /**
   * Web socket.
   */
  @JsonIgnore
  @Transient
  transient private ConcurrentWebSocketSessionDecorator session;
  /**
   * Mapper for publicly visible properties
   */
  @JsonIgnore
  @Transient
  transient private ObjectMapper mapper;
  /**
   * Private mapper even serializes private fields (so that client can receive own
   * secrets)
   */
  @JsonIgnore
  @Transient
  transient private ObjectMapper privateMapper;
  /**
   * guest flag hints SceneManager to remove all created/owned object when client
   * disconnects
   */
  @JsonIgnore
  @Transient
  @ToString.Include
  transient private boolean guest;

  public Client() {
    super();
    this.setActive(true);
  }

  // used in tests
  public Client(Long id) {
    this();
    this.setId(id);
  }

  // used in tests
  public Client(String name) {
    this();
    this.name = name;
  }

  public Client(ConcurrentWebSocketSessionDecorator session) {
    this();
    this.session = session;
  }

  /**
   * Process an event received from other active objects, typically other users.
   * This implementation serializes the event and sends it over websocket.
   */
  @Override
  public void processEvent(VREvent event) {
    if (!event.getSource().isActive()) {
      // stop listening to inactive objects (disconnected clients)
      event.getSource().removeListener(this);
    } else if (event.getPayload() == null) {
      // serialize event in the context of client
      sendMessage(event);
    } else {
      // event is already serialized by dispatcher
      send(event.getPayload());
    }
  }

  private void send(String json) {
    log.debug(getObjectId() + " Received " + json);
    if (session != null && session.isOpen()) {
      try {
        session.sendMessage(new TextMessage(json));
      } catch (IOException e) {
        log.debug("Can't send message " + json + " to " + this.getObjectId() + ": " + e);
      } catch (IllegalStateException e) {
        log.debug("Can't send message " + json + " to " + this.getObjectId() + ": " + e);
      }
    } else {
      log.debug("Session closed: " + session + ", message ignored: " + json);
    }
  }

  // CHECKME both commands and events end up here - split into two methods for
  // clarity/SoC? Also errors (Map) end up here...
  // Then again, it may not even be called from processEvent() due to
  // serialisation optimisation
  public void sendMessage(Object obj) {
    try {
      if (this.equals(obj) || obj instanceof Welcome) {
        send(privateMapper.writeValueAsString(obj));
      } else {
        send(mapper.writeValueAsString(obj));
      }
    } catch (Exception e) {
      // I don't see how this can happen, but if it does, make sure it's logged
      log.error("Can't send message " + obj, e);
    }

  }

  /** Returns token for a given service */
  public String getToken(String serviceId) {
    return tokens.get(serviceId);
  }

  /** Set token for a given service */
  public void setToken(String serviceId, String value) {
    if (value == null) {
      // CHECKME - should null be valid argument?
      this.clearToken(serviceId);
    } else {
      tokens.put(serviceId, value);
    }
  }

  /** Remove token for a given service */
  public String clearToken(String serviceId) {
    return tokens.remove(serviceId);
  }

  /**
   * Create client's scene, called by WorldManager during login process. Default
   * client doesn't have a scene.
   */
  public int createScene(WorldManager wm) {
    return 0;
  }

}
