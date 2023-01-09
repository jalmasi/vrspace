package org.vrspace.server.core;

import org.vrspace.server.obj.Terrain;
import org.vrspace.server.obj.TerrainPoint;

public class TerrainManager {
  VRObjectRepository db;

  public TerrainManager(VRObjectRepository db) {
    this.db = db;
  }

  public void save(TerrainPoint point) {
    TerrainPoint existing = db.getTerrainPoint(point.getTerrain().getId(), point.getIndex());
    if (existing == null) {
      existing = point;
    } else {
      existing.setX(point.getX());
      existing.setY(point.getY());
      existing.setZ(point.getZ());
    }
    db.save(existing);
    point.getTerrain().getPoints().remove(existing);
    point.getTerrain().getPoints().add(existing);
  }

  public void load(Terrain terrain) {
    terrain.setPoints(db.getTerrainPoints(terrain.getId()));
  }
}
