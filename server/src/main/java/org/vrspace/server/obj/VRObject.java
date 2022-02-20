package org.vrspace.server.obj;

import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.types.ID;

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
@Node
@ToString(callSuper = true)
public class VRObject extends Entity {

  private List<VRObject> children;

  @JsonIgnore
  @Relationship(type = "IN_WORLD", direction = Relationship.Direction.OUTGOING)
  // @Index - NeoConfig creates it
  private World world;

  @JsonMerge
  @Relationship(type = "HAS_POSITION", direction = Relationship.Direction.OUTGOING)
  private Point position;

  @JsonMerge
  private Rotation rotation;

  @JsonMerge
  @Relationship(type = "HAS_SCALE", direction = Relationship.Direction.OUTGOING)
  private Point scale;

  /** Permanent objects are always present (e.g. sky) */
  private Boolean permanent;

  /**
   * Temporary objects will be deleted from the database along with their owner
   */
  @Transient
  private transient Boolean temporary;

  /**
   * Whether an object is active (can send events). E.g. online users, robots.
   */
  // @JsonIgnore CHECKME: should we publish that?
  private Boolean active;

  /**
   * URL of the file containing the mesh.
   */
  private String mesh;

  private String script;

  /** Currently active animation */
  private String animation;

  /** Custom object properties */
  @Transient
  private transient Map<String, Object> properties;

  // video/audio stream attached to this object
  private transient String streamId;

  @JsonIgnore
  @Transient
  private ConcurrentHashMap<ID, VRObject> listeners;

  public VRObject(World world) {
    setWorld(world);
  }

  public VRObject(Long id, VRObject... vrObjects) {
    super(id);
    setWorld(world);
    addChildren(vrObjects);
  }

  public VRObject(Long id, double x, double y, double z, VRObject... vrObjects) {
    this(id, vrObjects);
    this.position = new Point(x, y, z);
  }

  public VRObject(double x, double y, double z) {
    setPosition(new Point(x, y, z));
  }

  public VRObject(World world, double x, double y, double z) {
    this(world);
    setPosition(new Point(x, y, z));
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

  public boolean isTemporary() {
    return temporary != null && temporary;
  }
}
