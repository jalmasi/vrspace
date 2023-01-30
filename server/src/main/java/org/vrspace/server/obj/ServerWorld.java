package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * World in which all servers reside. FIXME this class is never instantiated,
 * all we ever get is World class
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
  // FIXME can't be here
  @Override
  public boolean enter(Client client, WorldManager wm) {
    // TODO set some pre-defined url, e.g. portal
    client.setMesh(this.getPortalMesh());
    wm.save(client);
    // TODO position servers in a spiral
    return true;
  }
}
