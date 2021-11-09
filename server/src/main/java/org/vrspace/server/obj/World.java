package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.ToString;

/**
 * VRObject container, contains isolated parts of space, like chat room.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@RequiredArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true)
public class World extends Entity {
  // @Index(unique = true) - NeoConfig creates it
  @NonNull
  private String name;
  // there can be only one
  private boolean defaultWorld;
  // TODO more properties, e.g. streamingEnabled etc
}
