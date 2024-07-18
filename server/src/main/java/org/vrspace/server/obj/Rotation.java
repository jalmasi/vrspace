package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * Rotation of an can be represented either by 3 or 4 coordinates (euler angles,
 * quaternions), the server will store and distribute it either way.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = false)
@NoArgsConstructor
@AllArgsConstructor
@Node
public class Rotation extends Embedded {

  private double x, y, z;
  /** Typically null, if not, rotation is quaternion */
  private Double angle;

  public Rotation(double x, double y, double z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

}
