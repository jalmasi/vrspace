package org.vrspace.server.obj;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * Easier than Rotation to propagate quaternions, as it follows quaternion
 * naming convention (w rather than angle).
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = false)
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = false)
public class Quaternion {
  private double x;
  private double y;
  private double z;
  private double w;
}
