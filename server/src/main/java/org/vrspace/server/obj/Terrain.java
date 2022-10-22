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

@Data
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class Terrain extends VRObject {
  /** Transient property, used only to propagate changes to other clients */
  @Transient
  transient volatile private TerrainChange change;

  @JsonMerge
  @Relationship(type = "HAS_POINT", direction = Relationship.Direction.OUTGOING)
  private Set<TerrainPoint> points;

  @Data
  public static class TerrainChange {
    private long index;
    private Point point;
  }

  public void changed() {
    if (points == null) {
      points = new HashSet<>();
    }
    TerrainPoint point = new TerrainPoint(change.index, change.point);
    points.remove(point);
    points.add(point);
    this.change = null; // CHECKME thread-safe?
  }
}