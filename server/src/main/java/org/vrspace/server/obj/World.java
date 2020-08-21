package org.vrspace.server.obj;

import org.neo4j.ogm.annotation.Index;
import org.neo4j.ogm.annotation.NodeEntity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * VRObject container, contains isolated parts of space, like chat room.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NodeEntity
@ToString(callSuper = true)
public class World extends Entity {
  @Index(unique = true)
  private String name;
}
