package org.vrspace.server.obj;

import java.util.HashSet;
import java.util.Set;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonMerge;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;

@Data
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@Slf4j
public class Terrain extends VRObject {
  private Color diffuseColor;
  private Color emissiveColor;
  private Color specularColor;

  /** Transient property, used only to propagate changes to other clients */
  @Transient
  transient volatile private TerrainChange change;

  @JsonMerge
  @Relationship(type = "HAS_POINT", direction = Relationship.Direction.INCOMING)
  private Set<TerrainPoint> points;

  @Data
  public static class TerrainChange {
    private long index;
    private Point point;
  }

  @Override
  public void changed() {
    if (change == null) {
      // points have not changed
      return;
    }
    if (points == null) {
      points = new HashSet<>();
    }
    TerrainPoint point = new TerrainPoint(this, change.index, change.point);
    if (points.remove(point)) {
      log.debug("Point removed, size " + points.size());
    }
    if (points.add(point)) {
      log.debug("Point added, size " + points.size());
    }
    this.change = null; // CHECKME thread-safe?
  }
}