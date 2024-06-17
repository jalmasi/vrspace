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
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.AccessLevel;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * Basic VR Object encapsulates minimal spatial and other properties.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Slf4j
public class VRObject extends Entity {

  private List<VRObject> children;

  /* World this object is in, only id is persisted */
  @JsonIgnore
  private Long worldId;
  @Transient
  @Setter(AccessLevel.NONE)
  @JsonIgnore
  /* World this object is in, not persisted to avoid deadlocks */
  private transient World world;

  public void setWorld(World world) {
    if (world == null) {
      this.setWorldId(null);
    } else {
      this.setWorldId(world.getId());
    }
    this.world = world;
  }

  /**
   * Position in 3D space, used for spatial operations.
   */
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

  /**
   * Script that client runs. To prevent cross-site scripting, this is a read-only
   * property.
   */
  @JsonProperty(access = JsonProperty.Access.READ_ONLY)
  private String script;

  /** Currently active animation */
  @JsonMerge
  @Relationship(type = "CURRENT_ANIMATION", direction = Relationship.Direction.OUTGOING)
  private Animation animation;

  /** Custom object properties */
  @Transient
  private transient Map<String, Object> properties;

  @JsonIgnore
  @Transient
  private ConcurrentHashMap<ID, VRObject> listeners;

  public VRObject(World world) {
    setWorldId(world.getId());
  }

  public VRObject(Long id, VRObject... vrObjects) {
    super(id);
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
        try {
          listener.processEvent(event);
        } catch (Exception e) {
          log.error("Error processing event " + event, e);
        }
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
