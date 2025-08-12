package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = false)
@Node
/**
 * Simple key-value pair that can be attached to any VRObject, but is most
 * useful when attached to Client, as it allows to persist custom user
 * information.
 * 
 * @author joe
 *
 */
public class UserData extends Entity {
  @JsonIgnore
  @Relationship(type = "USER_DATA", direction = Relationship.Direction.OUTGOING)
  private VRObject object;
  private String key;
  private String value;

  @JsonIgnore
  public String getId() {
    return super.getId();
  }

}
