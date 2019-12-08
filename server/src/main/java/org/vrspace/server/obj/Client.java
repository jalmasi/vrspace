package org.vrspace.server.obj;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.neo4j.ogm.annotation.Index;
import org.neo4j.ogm.annotation.NodeEntity;
import org.neo4j.ogm.annotation.Transient;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.Owned;
import org.vrspace.server.Private;
import org.vrspace.server.Scene;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = false)
@NodeEntity
@Owned
public class Client extends VRObject {
  private static final Log LOG = LogFactory.getLog(VRObject.class);

  @Index(unique = true)
  private String name;

  // CHECKME: this needs to get refactored eventually
  @JsonIgnore
  private Set<VRObject> owned;

  @Private
  @Transient
  transient private SceneProperties sceneProperties;

  @JsonIgnore
  @Transient
  transient private WebSocketSession session;
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

  public Client(WebSocketSession session) {
    this();
    this.session = session;
  }

  @Override
  public void processEvent(VREvent event) {
    sendMessage(event);
    // stop listening to inactive objects (disconnected clients)
    if (!event.getSource().isActive()) {
      event.getSource().removeListener(this);
      // CHECKME: do we wish to force scene refresh?
      scene.setDirty();
    }
  }

  public void sendMessage(Object obj) {
    try {
      String json = mapper.writeValueAsString(obj);
      LOG.debug(getObjectId() + " Received " + json);
      session.sendMessage(new TextMessage(json));
    } catch (IOException e) {
      LOG.error("Can't send message " + obj, e);
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
