package org.vrspace.server.obj;

import java.util.ArrayList;
import java.util.List;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
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
