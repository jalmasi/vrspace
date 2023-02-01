package org.vrspace.server.obj;

import java.util.List;

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

      // TODO figure out positions
      // TODO position servers in a spiral
      // dl^2 = k^2 * da^2 + k^2 * a^2 * da^2
      // = da^2 * k^2 * (1+a^2)
      // where l = lenght, a = angle (alpha), k = size parameter
      // so to have constant dl (place portals same distance from one another)
      // we have to change angle by
      // da^2 = dl^2/(k^2*(1+a^2))
      // da = sqrt(dl^2/(k^2*(1+a^2)))
      // where a is the current angle
      // List<VRObject> currentServers = wm.find(o ->
      // (o.getClass().isInstance(RemoteServer.class)));
      List<VRObject> currentServers = wm.find(o -> (true));
      double dl = 10; // place portals that many meters apart
      double k = 2; // is this two meters radius increase for 1 radian?
      double angle = 0;
      for (VRObject obj : currentServers) {
        double da = Math.sqrt(dl * dl / (k * k * (1 + angle * angle)));
        angle += da;
        // TODO we probably need to recalculate positions of all portals
        // since some servers may have disconnected in the meantime
      }
      double r = k * angle;
      double x = Math.cos(angle) * r;
      double z = Math.sin(angle) * r;

      client.setPosition(new Point(x, 0, z));
      Rotation rot = new Rotation(0, angle, 0);
      client.setRotation(rot);
      wm.save(client);
    }
    return true;
  }
}
