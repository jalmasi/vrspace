package org.vrspace.server.obj;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

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
@Slf4j
public class ServerWorld extends World {
  private String url;
  private String portalMesh;
  private String portalThumbnail;
  private String portalScript;
  @Transient
  private transient ConcurrentHashMap<Long, RemoteServer> currentServers = new ConcurrentHashMap<>();
  @Transient
  private AtomicLong serverCount = new AtomicLong();

  @Override
  public synchronized boolean enter(Client client, WorldManager wm) {
    if (client instanceof RemoteServer) {
      RemoteServer server = (RemoteServer) client;
      serverCount.incrementAndGet();
      currentServers.put(server.getId(), server);
      log.debug("Server " + server.getId() + " of " + serverCount.get() + ", size " + currentServers.size());

      server.setMesh(this.getPortalMesh());
      server.setScript(this.getPortalScript());
      if (server.getUrl() == null) {
        server.setUrl(this.getUrl());
      }
      if (server.getThumbnail() == null) {
        server.setThumbnail(this.getPortalThumbnail());
      }

      // position servers in a spiral
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
      double dl = 10; // place portals that many meters apart
      double k = 2; // is this two meters radius increase for 1 radian?
      double angle = 0;
      for (VRObject obj : currentServers.values()) {
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

  @Override
  public void exit(Client client, WorldManager wm) {
    if (client instanceof RemoteServer) {
      RemoteServer server = (RemoteServer) client;
      serverCount.decrementAndGet();
      currentServers.remove(server.getId());
    }

  }
}
