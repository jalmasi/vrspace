package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Node
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true)
public class Ownership extends Entity {
  @Relationship(type = "IS_OWNER", direction = Relationship.Direction.OUTGOING)
  private Client owner;
  @Relationship(type = "IS_OWNED", direction = Relationship.Direction.OUTGOING)
  private VRObject owned;
}
