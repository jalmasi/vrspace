package org.vrspace.server.types;

import java.util.HashMap;
import java.util.Map;

import org.vrspace.server.obj.Entity;

import lombok.Data;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

/**
 * Object ID is class name + a number.
 * 
 * @author joe
 *
 */
@Data
@RequiredArgsConstructor
public class ID {
  @NonNull
  private String className;
  @NonNull
  private String id;

  public <T extends Entity> ID(T obj) {
    this.className = obj.getClass().getSimpleName();
    this.id = obj.getId();
  }

  public <T extends Entity> ID(Class<T> cls, String id) {
    this.className = cls.getSimpleName();
    this.id = id;
  }

  public ID(Map<String, String> map) {
    if (map.size() != 1) {
      throw new IllegalArgumentException(
          "Map has to contain only one element, containing class name (key) and id (value)");
    }
    map.forEach((k, v) -> {
      this.className = k;
      this.id = v;
    });
  }

  public Map<String, String> map() {
    Map<String, String> ret = new HashMap<String, String>(1);
    ret.put(className, id);
    return ret;
  }
}
