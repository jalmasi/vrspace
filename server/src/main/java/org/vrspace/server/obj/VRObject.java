package org.vrspace.server.obj;

import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import org.neo4j.ogm.annotation.NodeEntity;
import org.neo4j.ogm.annotation.Relationship;
import org.neo4j.ogm.annotation.Transient;
import org.vrspace.server.ID;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonMerge;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@NoArgsConstructor
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NodeEntity
@ToString(callSuper = true)
public class VRObject extends Entity {

  private List<VRObject> children;

  @JsonMerge
  @Relationship(type = "HAS_POSITION", direction = Relationship.OUTGOING)
  private Point position;

  @JsonMerge
  private Rotation rotation;

  @JsonMerge
  @Relationship(type = "HAS_SCALE", direction = Relationship.OUTGOING)
  private Point scale;

  private Boolean permanent;

  // @JsonIgnore CHECKME: should we publish that?
  private Boolean active;

  private String mesh;

  private String script;

  @JsonIgnore
  @Transient
  private ConcurrentHashMap<ID, VRObject> listeners;

  public VRObject(Long id, VRObject... vrObjects) {
    super(id);
    addChildren(vrObjects);
  }

  public VRObject(Long id, double x, double y, double z, VRObject... vrObjects) {
    this(id, vrObjects);
    this.position = new Point(x, y, z);
  }

  public VRObject(double x, double y, double z) {
    this.position = new Point(x, y, z);
  }

  public void addChildren(VRObject... vrObjects) {
    if (children == null) {
      children = new LinkedList<VRObject>();
    }
    for (VRObject obj : vrObjects) {
      if (equals(obj)) {
        // weak protection against circular references
        throw new IllegalArgumentException("Can't have self as member");
      }
      children.add(obj);
    }
  }

  public boolean isPermanent() {
    return permanent != null && permanent;
  }

  public void addListener(VRObject obj) {
    if (listeners == null) {
      listeners = new ConcurrentHashMap<ID, VRObject>();
    }
    listeners.put(new ID(obj), obj);
  }

  public void removeListener(VRObject obj) {
    if (listeners != null) {
      listeners.remove(new ID(obj));
    }
  }

  public void notifyListeners(VREvent event) {
    if (listeners != null) {
      for (VRObject listener : listeners.values()) {
        listener.processEvent(event);
      }
    }
  }

  /**
   * This implementation does nothing
   * 
   * @param event Whatever has changed
   */
  public void processEvent(VREvent event) {
  }

  @JsonIgnore
  public ID getObjectId() {
    return new ID(this);
  }

  public VRObject active() {
    this.active = Boolean.TRUE;
    return this;
  }

  public VRObject passive() {
    this.active = Boolean.FALSE;
    return this;
  }

  public boolean isActive() {
    return active != null && active;
  }

}
