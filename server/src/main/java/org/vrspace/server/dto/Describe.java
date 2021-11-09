package org.vrspace.server.dto;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class Describe implements Command {
  private String className;

  @Override
  public ClientResponse execute(WorldManager world, Client client) throws ClassNotFoundException {
    if (className == null) {
      Map<String, String> ret = world.listClasses().stream()
          .collect(Collectors.toMap(Class::getSimpleName, c -> c.getSuperclass().getSimpleName()));
      return new ClientResponse(ret);
    } else {
      Map<String, String> ret = new LinkedHashMap<String, String>();
      Class<?> cls = Class.forName("org.vrspace.server." + className);
      Map<String, Field> fields = getFields(cls);
      for (Method m : cls.getMethods()) {
        if (m.getName().startsWith("get") && !"getClass".equals(m.getName())) {
          if (m.isAnnotationPresent(JsonIgnore.class)) {
            continue;
          }
          String fieldName = m.getName().substring(3, 4).toLowerCase() + m.getName().substring(4);
          String fieldType = m.getReturnType().getSimpleName();
          // also check annotations on fields
          if (fields.containsKey(fieldName)) {
            ret.put(fieldName, fieldType);
          }
        }
      }
      return new ClientResponse(ret);
    }
  }

  private Map<String, Field> getFields(Class<?> cls) {
    Map<String, Field> ret = null;
    // CHECKME: Entity or VRObject?
    // IOW, include ID or not?
    if (Entity.class.isAssignableFrom(cls.getSuperclass())) {
      ret = getFields(cls.getSuperclass());
    } else {
      ret = new LinkedHashMap<String, Field>();
    }
    for (Field f : cls.getDeclaredFields()) {
      if (!f.isAnnotationPresent(JsonIgnore.class) && !Modifier.isStatic(f.getModifiers())) {
        ret.put(f.getName(), f);
      }
    }
    return ret;
  }

}
