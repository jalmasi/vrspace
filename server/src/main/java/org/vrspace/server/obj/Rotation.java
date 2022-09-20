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

  public double x, y, z, angle;

}
