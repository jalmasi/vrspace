package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.types.Owned;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@Owned
public class RemoteServer extends Client {
  private String url;
  private String thumbnail;

  // CHECKME basic VRObject should probably do that to prevent XSS for good
  /*
   * @Override public void setScript(String script) { throw new
   * SecurityException("Forbidden"); }
   */
}
