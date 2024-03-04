package org.vrspace.server.obj;

import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * World in which all servers reside, created by WorldManager on startup. Once a
 * RemoteServer enters here, its properties are set to defaults defined in
 * application.properties, i.e portalMesh and portalScript of this object.
 * Properties of other clients (users) are not changed.
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
  private AtomicInteger serverCount = new AtomicInteger();
  @Transient
  private transient double dl = 10; // place portals that many meters apart
  @Transient
  private transient double k = 2; // is this two meters radius increase for 1 radian?

  @Override
  public synchronized boolean enter(Client client, WorldManager wm) {
    if (client instanceof RemoteServer) {
      RemoteServer server = (RemoteServer) client;
      server.setOrder(serverCount.getAndIncrement());
      currentServers.put(server.getId(), server);
      log.debug("Connecting portal " + server.getOrder() + "/" + serverCount + " size " + currentServers.size());

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
      double angle = 0;
      RemoteServer[] servers = currentServers.values().toArray(new RemoteServer[currentServers.size()]);
      Arrays.sort(servers, (o1, o2) -> o1.getOrder() - o2.getOrder());
      for (int i = 0; i < servers.length; i++) {
        RemoteServer portal = servers[i];
        portal.setOrder(i);
        // we need to recalculate positions of all portals
        // since some servers may have disconnected in the meantime
        double da = Math.sqrt(dl * dl / (k * k * (1 + angle * angle)));
        angle += da;
        setPortalPosition(portal, angle);
      }
      wm.save(server);
      log.debug("New portal " + server.getOrder() + "/" + serverCount);
    }
    return true;
  }

  private void setPortalPosition(RemoteServer portal, double angle) {
    double r = k * angle;
    double x = Math.cos(angle) * r;
    double z = Math.sin(angle) * r;

    portal.setPosition(new Point(x, 0, z));
    Rotation rot = new Rotation(0, angle, 0);
    portal.setRotation(rot);
  }

  @Override
  public synchronized void exit(Client client, WorldManager wm) {
    if (client instanceof RemoteServer) {
      RemoteServer server = (RemoteServer) client;
      serverCount.decrementAndGet();
      currentServers.remove(server.getId());
      log.debug("Removed portal " + server.getOrder() + "/" + serverCount + " size " + currentServers.size());
    }

  }
}
