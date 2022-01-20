package org.vrspace.server.obj;

import java.io.IOException;
import java.util.HashSet;
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
import org.vrspace.server.types.Owned;
import org.vrspace.server.types.Private;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = false)
@Node
@Owned
@Slf4j
public class Client extends VRObject {
  // @Index(unique = true) - NeoConfig creates it
  private String name;
  @Transient
  transient private Point leftArmPos;
  @Transient
  transient private Point rightArmPos;
  @Transient
  transient private Quaternion leftArmRot;
  @Transient
  transient private Quaternion rightArmRot;
  @Transient
  transient private Double userHeight;

  @JsonIgnore
  @Relationship(type = "OWNS", direction = Relationship.Direction.OUTGOING)
  private Set<VRObject> owned;

  @Private
  @Transient
  transient private SceneProperties sceneProperties;

  // CHECKME OpenVidu token; should that be Map tokens?
  @Private
  @Transient
  transient private String token;

  @JsonIgnore
  @Transient
  transient private WriteBack writeBack;

  @Private
  @JsonIgnore
  private String identity;

  @JsonIgnore
  @Transient
  transient private ConcurrentWebSocketSessionDecorator session;
  @JsonIgnore
  @Transient
  transient private Scene scene;
  @JsonIgnore
  @Transient
  transient private ObjectMapper mapper;
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
      send(mapper.writeValueAsString(obj));
    } catch (Exception e) {
      // I don't see how this can happen, but if it does, make sure it's logged
      log.error("Can't send message " + obj, e);
    }

  }

  public void addOwned(VRObject... objects) {
    if (owned == null) {
      owned = new HashSet<VRObject>();
    }
    for (VRObject obj : objects) {
      owned.add(obj);
    }
  }

  public void removeOwned(VRObject... objects) {
    if (owned != null) {
      for (VRObject obj : objects) {
        owned.remove(obj);
      }
    }
  }

  public boolean isOwner(VRObject obj) {
    return this.equals(obj) || owned != null && obj != null && owned.contains(obj);
  }

}
