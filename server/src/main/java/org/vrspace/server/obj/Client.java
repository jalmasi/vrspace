package org.vrspace.server.obj;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.core.Scene;
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
@ToString(callSuper = false)
@Node
@Owned
@Slf4j
public class Client extends VRObject {
  /**
   * Client name - unique ID.
   */
  // @Index(unique = true) - NeoConfig creates it
  private String name;
  /**
   * Left arm position, used in VR. Transient biometric data.
   */
  @Transient
  transient private Point leftArmPos;
  /**
   * Right arm position, used in VR. Transient biometric data.
   */
  @Transient
  transient private Point rightArmPos;
  /**
   * Left arm rotation, used in VR. Transient biometric data.
   */
  @Transient
  transient private Quaternion leftArmRot;
  /**
   * Right arm rotation, used in VR. Transient biometric data.
   */
  @Transient
  transient private Quaternion rightArmRot;
  /**
   * User's height in real life, used in VR. Transient biometric data.
   */
  @Transient
  transient private Double userHeight;
  /**
   * Owned objects.
   */
  @JsonIgnore
  @Relationship(type = "OWNS", direction = Relationship.Direction.OUTGOING)
  private Set<VRObject> owned;
  /**
   * Properties of the scene - how far a user sees, how much objects...
   */
  @Private
  @Transient
  transient private SceneProperties sceneProperties;
  /**
   * Tokens used to access video/audio streaming servers, identify conversations
   * with chatbots etc.
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
   * Identity is a big unknown yet, will likely get encapsulated in a class. For
   * the time being, it's something like username@oauth2provider, e.g.
   * joe@facebook
   */
  @Private
  @JsonIgnore
  private String identity;
  /**
   * Web socket.
   */
  @JsonIgnore
  @Transient
  transient private ConcurrentWebSocketSessionDecorator session;
  /**
   * Scene contains all object that a client tracks, e.g. user sees.
   */
  @JsonIgnore
  @Transient
  transient private Scene scene;
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
        log.warn("Can't send message " + json + ": " + e);
      } catch (IllegalStateException e) {
        log.warn("Can't send message " + json + ": " + e);
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

  /**
   * Add some owned objects to this client. By default, all objects created by a
   * client become owned.
   * 
   * @param objects
   */
  public void addOwned(VRObject... objects) {
    if (owned == null) {
      owned = new HashSet<VRObject>();
    }
    for (VRObject obj : objects) {
      owned.add(obj);
    }
  }

  /**
   * Remove owned objects, i.e. give up ownership.
   * 
   * @param objects
   */
  public void removeOwned(VRObject... objects) {
    if (owned != null) {
      for (VRObject obj : objects) {
        owned.remove(obj);
      }
    }
  }

  /**
   * Is this object owned by this client? Also, a client owns itself.
   * 
   * @param obj
   * @return
   */
  public boolean isOwner(VRObject obj) {
    return this.equals(obj) || owned != null && obj != null && owned.contains(obj);
  }

  /** Returns token for a given service */
  public String getToken(String serviceId) {
    return tokens.get(serviceId);
  }

  /** Set token for a given service */
  public void setToken(String serviceId, String value) {
    if (value == null) {
      this.clearToken(serviceId);
    }
    tokens.put(serviceId, value);
  }

  /** Remove token for a given service */
  public String clearToken(String serviceId) {
    return tokens.remove(serviceId);
  }

}
