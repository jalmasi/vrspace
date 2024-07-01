package org.vrspace.server.obj;

import java.io.File;

import org.springframework.data.neo4j.core.schema.Node;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Basic content class. Early version, not used on its own, likely to change.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@Node
@Slf4j
public class Content extends Embedded {
  private String fileName;
  @JsonIgnore
  private String folder;
  private String contentType;
  private long length;

  public void dispose() {
    File dest = new File(folder + File.separator + fileName);
    if (dest.delete()) {
      log.debug("Removed " + this);
    } else {
      log.warn("Cannot remove " + dest);
    }
  }
}
