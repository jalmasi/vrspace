package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * World in which all servers reside
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true)
public class ServerWorld extends World {
  @Override
  public boolean enter(Client client, WorldManager wm) {
    // TODO position servers in a spiral
    // TODO set some pre-defined url, e.g. portal
    return true;
  }
}
