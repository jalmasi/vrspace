package org.vrspace.server.obj;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.annotation.Transient;
import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;

/**
 * A Bot is a Client that has no session. It does have own scene, and observes
 * all events in the scene. It also responds to something that user(s) write.
 * 
 * @author joe
 *
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
public abstract class Bot extends User {
  private String gender;
  private String lang;
  @JsonIgnore
  private String url;
  @JsonIgnore
  @Transient
  private Map<String, String> parameterMap = new HashMap<>();

  /**
   * Returns a parameter from parameter map
   */
  public String getParameter(String key) {
    return parameterMap.get(key);
  }

  /**
   * Self test runs on server startup. Exceptions are logged but otherwise
   * ignored.
   * 
   * @throws Exception
   */
  public abstract void selfTest() throws Exception;

  public abstract String getResponse(Client c, String query);

  /**
   * Get response to something that a client "said", and write it
   */
  public void respondTo(Client c, String what) {
    String response = getResponse(c, what);
    write(response);
  }

  /**
   * Utility method - "say" something.
   */
  public void write(String what) {
    VREvent event = new VREvent(this);
    Map<String, Object> changes = new HashMap<>();
    changes.put("wrote", what);
    event.setChanges(changes);
    this.notifyListeners(event);
  }

  /**
   * Process an event. If that's something that a user wrote, calls respondTo
   * method. Other events are ignored.
   */
  @Override
  public void processEvent(VREvent event) {
    log.debug(this + " received event: " + event);
    if (!event.getSource().isActive()) {
      // stop listening to inactive objects (disconnected clients)
      event.getSource().removeListener(this);
    } else if (event.getChanges().containsKey("wrote")) {
      String what = (String) event.getChanges().get("wrote");
      respondTo(event.getClient(), what);
    }
  }

  /**
   * New objects in the scene, typically a client that has arrived. This
   * implementation does nothing, utility method for subclasses.
   */
  public void objectsAdded(List<VRObject> objects) {
    log.debug("New objects in the scene " + objects);
  }

  /**
   * Objects removed from the scene, typically a client that has left. This
   * implementation does nothing, utility method for subclasses.
   * 
   * @param objects
   */
  public void objectsRemoved(List<Map<String, Long>> objects) {
    log.debug("Removed objects from the scene " + objects);
  }

  /**
   * Scene management method, called when the scene changes.
   */
  @Override
  public void sendMessage(Object o) {
    log.debug(this + " received message:" + o);
    // TODO: process Add/Remove commands
    if (o instanceof Add) {
      objectsAdded(((Add) o).getObjects());
    } else if (o instanceof Remove) {
      objectsRemoved(((Remove) o).getObjects());
    }
  }

  @Override
  public String toString() {
    return getId().toString();
  }
}
