package org.vrspace.server.types;

import java.util.HashMap;
import java.util.Map;

import org.vrspace.server.obj.Entity;

import lombok.Data;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

@Data
@RequiredArgsConstructor
public class ID {
  @NonNull
  private String className;
  @NonNull
  private Long id;

  public <T extends Entity> ID(T obj) {
    this.className = obj.getClass().getSimpleName();
    this.id = obj.getId();
  }

  public ID(Map<String, Long> map) {
    if (map.size() != 1) {
      throw new IllegalArgumentException(
          "Map has to contain only one element, containing class name (key) and id (value)");
    }
    map.forEach((k, v) -> {
      this.className = k;
      this.id = v;
    });
  }

  public Map<String, Long> map() {
    Map<String, Long> ret = new HashMap<String, Long>(1);
    ret.put(className, id);
    return ret;
  }
}
