package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = false)
@Node
public class Point extends Embedded {
  // @Index - created in NeoConfig
  @EqualsAndHashCode.Include
  private double x;
  // @Index
  @EqualsAndHashCode.Include
  private double y;
  // @Index
  @EqualsAndHashCode.Include
  private double z;

  public Point(Point position) {
    this(position.x, position.y, position.z);
  }

  public double getDistance(double x, double y, double z) {
    double dx = this.x - x;
    double dy = this.y - y;
    double dz = this.z - z;
    return (double) Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public boolean isInRange(Point p, double range) {
    return isInRange(p.x, p.y, p.z, range);
  }

  public boolean isInRange(double x, double y, double z, double range) {
    return this.x >= x - range && this.x <= x + range && this.y >= y - range && this.y <= y + range
        && this.z >= z - range && this.z <= z + range;
  }

  public Point copy(Point p) {
    this.x = p.x;
    this.y = p.y;
    this.z = p.z;
    return this;
  }

  public Point plus(double val) {
    x += val;
    y += val;
    z += val;
    return this;
  }

  public Point minus(double val) {
    x -= val;
    y -= val;
    z -= val;
    return this;
  }

  /**
   * Utility method, confirms that coordinates of this point match the coordinates
   * of the other point. Method equals() can't be used for that purpose as it
   * includes object id - requirement for persistence.
   * 
   * @param p Point to compare
   * @return true if all coordinates are equal
   */
  public boolean isEqual(Point p) {
    return p.x == x && p.y == y && p.z == z;
  }
}
