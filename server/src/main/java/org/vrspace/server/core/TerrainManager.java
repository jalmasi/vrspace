package org.vrspace.server.core;

import java.util.HashSet;

import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Terrain;
import org.vrspace.server.obj.TerrainPoint;

public class TerrainManager extends PersistenceManager<Terrain> {
  VRObjectRepository db;

  public TerrainManager(VRObjectRepository db) {
    this.db = db;
  }

  @Override
  public void persist(VREvent event) {
    Terrain t = (Terrain) event.getSource();
    if (t.getChange() == null) {
      event.getClient().getWriteBack().write(event.getSource());
      return;
    }

    TerrainPoint point = db.getTerrainPoint(t.getId(), t.getChange().getIndex());
    if (point == null) {
      point = new TerrainPoint(t, t.getChange().getIndex(), t.getChange().getPoint());
    } else {
      point.setX(point.getX());
      point.setY(point.getY());
      point.setZ(point.getZ());
    }
    db.save(point);

    if (t.getPoints() == null) {
      t.setPoints(new HashSet<>());
    } else {
      t.getPoints().remove(point);
    }

    t.getPoints().add(point);
  }

  @Override
  public void postLoad(Terrain terrain) {
    terrain.setPoints(db.getTerrainPoints(terrain.getId()));
  }
}
