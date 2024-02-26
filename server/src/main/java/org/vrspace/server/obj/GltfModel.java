package org.vrspace.server.obj;

import java.util.ArrayList;
import java.util.List;

import org.springframework.data.neo4j.core.schema.Node;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * A 3D Model in GLTF format. Adds unique id, uri and other properties to
 * Content class. Based on sketchfab models.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class GltfModel extends Content {
  private String uid; // TODO: unique index
  private String uri;
  private String name;
  private String description;
  private String license;
  private String author;
  private List<ContentCategory> categories = new ArrayList<ContentCategory>();
  private String mesh;

  public GltfModel() {
    super();
    this.setContentType("model/gltf+json");
  }

  public String mainCategory() {
    if (categories.size() == 0) {
      return "unsorted";
    }
    return categories.get(0).getName();
  }
}
