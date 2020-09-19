package org.vrspace.server.obj;

import java.util.List;
import java.util.Map;

import org.neo4j.ogm.annotation.NodeEntity;
import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.VREvent;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * Persistent version of event that can be stored to the database.
 * 
 * @see EventRecorder
 * @author joe
 *
 */
@Data
@NodeEntity
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = false, onlyExplicitlyIncluded = true)
public class PersistentEvent extends Entity {
  private long delay;
  private String type;
  private VRObject source;
  // Neo4j can't store this:
  private transient Map<String, Object> changes;
  // so we store it converted to JSON string:
  private String payload;
  private List<VRObject> add;
  private List<Map<String, Long>> remove;

  public PersistentEvent() {
  }

  public PersistentEvent(long delay, String type) {
    this.delay = delay;
    this.type = type;
  }

  public PersistentEvent(long delay, String type, VREvent event, VRObject source) {
    this(delay, type);
    this.changes = event.getChanges();
    this.payload = event.getPayload();
    if (this.payload == null) {
      throw new IllegalArgumentException("Event can't be persisted, payload is null");
    }
    this.source = source;
  }

  public PersistentEvent(long delay, String type, Command cmd) {
    this(delay, type);
    if (cmd instanceof Add) {
      this.add = ((Add) cmd).getObjects();
    } else if (cmd instanceof Remove) {
      this.remove = ((Remove) cmd).getObjects();
    } else {
      throw new IllegalArgumentException("Unsupported Command: " + cmd);
    }
  }

  public VREvent getEvent() {
    VREvent ret = new VREvent(this.source);
    ret.setChanges(this.changes);
    ret.setPayload(this.payload);
    return ret;
  }

  public Object getMessage() {
    if (this.add != null) {
      return new Add(this.add);
    } else if (this.remove != null) {
      return new Remove(this.remove);
    } else {
      return this.getEvent();
    }
  }

  public boolean restart() {
    return "own".equals(this.type) && this.source == null;
  }

}
