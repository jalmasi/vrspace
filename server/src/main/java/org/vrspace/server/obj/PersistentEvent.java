package org.vrspace.server.obj;

import java.util.List;
import java.util.Map;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
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
@Node
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = false)
public class PersistentEvent extends Entity {
  private long delay;
  private String type;
  private VRObject source;
  // Neo4j can't store this:
  @Transient
  private transient Map<String, Object> changes;
  // so we store it converted to JSON string:
  private String payload;
  private List<VRObject> add;
  private List<Map<String, Long>> remove;

  public PersistentEvent() {
  }

  private PersistentEvent(long delay, String type) {
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
    // note that payload contains different client id, one of originally recorder
    // client, it must not be replayed as it is
    ret.setPayload(null);
    // apply original changes to this object
    ret.setChanges(this.changes);
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

}
