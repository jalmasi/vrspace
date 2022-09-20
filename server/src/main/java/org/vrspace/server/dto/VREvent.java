package org.vrspace.server.dto;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * An event that happened to an object. Event can change one or more properties
 * of an object, and can be generated internally. It's typically received from a
 * client, and represents changes to clients own properties, e.g. position.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@JsonInclude(Include.NON_EMPTY)
// ignore all internally set transient fields
@EqualsAndHashCode(exclude = { "source", "client", "payload" })
public class VREvent {
  /**
   * ID (class name + id ) suitable for serialization.
   */
  private Map<String, Long> object = new LinkedHashMap<String, Long>(1);
  /**
   * Changes to the object. Multiple changes to same property are going to be
   * 'collapsed', i.e. last value of a field overrides any previous values.
   */
  private Map<String, Object> changes = new LinkedHashMap<String, Object>();

  /** Event timestamp in UTC */
  private LocalDateTime timestamp = LocalDateTime.now(ZoneId.of("UTC"));

  @JsonIgnore
  private String className;
  @JsonIgnore
  private Long id;
  @JsonIgnore
  private VRObject source;
  @JsonIgnore
  private Client client;
  @JsonIgnore
  private String payload;

  public VREvent(VRObject source, Client client) {
    this(source);
    this.client = client;
  }

  public VREvent(VRObject source) {
    this.object.put(source.getClass().getSimpleName(), source.getId());
    this.source = source;
  }

  public VREvent addChange(String field, Object value) {
    changes.put(field, value);
    return this;
  }

  @JsonIgnore
  public String getSourceClassName() {
    if (className == null) {
      className = object.keySet().iterator().next();
    }
    return className;
  }

  @JsonIgnore
  public Long getSourceId() {
    if (id == null) {
      id = object.values().iterator().next();
    }
    return id;
  }

  @JsonIgnore
  public ID getSourceID() {
    return new ID(getSourceClassName(), getSourceId());
  }

  @JsonIgnore
  public boolean sourceIs(VRObject obj) {
    return getSourceId().equals(obj.getId()) && getSourceClassName().equals(obj.getClass().getSimpleName());
  }

}
