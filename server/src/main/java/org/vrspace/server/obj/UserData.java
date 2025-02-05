package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

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
public class UserData extends Entity {
  @Relationship(type = "USER_DATA", direction = Relationship.Direction.OUTGOING)
  private VRObject object;
  private String key;
  private String value;
}
