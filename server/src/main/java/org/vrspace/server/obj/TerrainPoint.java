package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * A terrain point. Does not extend Point to make sure it doesn't get in the way
 * of range/visibility processing.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = false, onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = false)
@Node
public class TerrainPoint extends Embedded {
  @JsonIgnore
  @Relationship(type = "IS_POINT_OF", direction = Relationship.Direction.OUTGOING)
  @EqualsAndHashCode.Include
  private Terrain terrain;
  @EqualsAndHashCode.Include
  private Long index;
  private double x;
  private double y;
  private double z;

  public TerrainPoint(Terrain t, Long index, Point point) {
    this.terrain = t;
    this.index = index;
    this.x = point.getX();
    this.y = point.getY();
    this.z = point.getZ();
  }

}
