package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * A shared animation, embedded into VRObject. TODO more shared properties to
 * come.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = false)
@Node
public class Animation extends Embedded {
  private String name;
  private boolean loop;
  private double speedRatio;
}
