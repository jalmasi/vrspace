package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Represents a membership of a user in a group
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@AllArgsConstructor
@NoArgsConstructor
public class GroupMember extends Entity {
  @Relationship(type = "IS_MEMBER_OF", direction = Relationship.Direction.OUTGOING)
  private UserGroup group;
  @Relationship(type = "MEMBER_CLIENT", direction = Relationship.Direction.OUTGOING)
  private Client client;
}
