package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * World in which all servers reside. Once a RemoteServer enters here, its
 * properties are set to defaults defined in application.properties, i.e
 * portalMesh, portalThumbnail and portalScript of this object. Properties of
 * other clients (users) are not changed.
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
  private String url;
  private String portalMesh;
  private String portalThumbnail;
  private String portalScript;

  @Override
  public boolean enter(Client client, WorldManager wm) {
    if (client instanceof RemoteServer) {
      client.setMesh(this.getPortalMesh());
      client.setScript(this.getPortalScript());
      ((RemoteServer) client).setUrl(this.getUrl());
      ((RemoteServer) client).setThumbnail(this.getPortalThumbnail());
    }
    // TODO figure out positions
    wm.save(client);
    // TODO position servers in a spiral
    return true;
  }
}
