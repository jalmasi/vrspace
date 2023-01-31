package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.ToString;

/**
 * VRObject container, contains isolated parts of space, like chat room. One
 * default world is created on startup, others are typically created on demand,
 * after Enter command is issued.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@RequiredArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true)
public class World extends Entity {
  // @Index(unique = true) - NeoConfig creates it
  @NonNull
  private String name;
  // there can be only one
  private boolean defaultWorld;

  public World(String name, boolean defaultWorld) {
    this.name = name;
    this.defaultWorld = defaultWorld;
  }

  /**
   * Called when client enters the world. It may change some client properties,
   * allow entrance or not, etc.
   * 
   * @return true if client is allowed to enter
   */
  public boolean enter(Client c, WorldManager wm) {
    return true;
  }

}
