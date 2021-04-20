package org.vrspace.server.core;

import com.fasterxml.jackson.annotation.JsonTypeInfo.Id;
import com.fasterxml.jackson.databind.DatabindContext;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.jsontype.impl.TypeIdResolverBase;

/**
 * Custom jackson type resolver, used to deserialize Commands residing in
 * org.vrspace.server.dto package
 * 
 * @author joe
 *
 */
public class CustomTypeIdResolver extends TypeIdResolverBase {

  private JavaType superType;

  @Override
  public void init(JavaType baseType) {
    superType = baseType;
  }

  @Override
  public Id getMechanism() {
    return Id.NAME;
  }

  @Override
  public String idFromValue(Object obj) {
    return idFromValueAndType(obj, obj.getClass());
  }

  @Override
  public String idFromValueAndType(Object obj, Class<?> subType) {
    return subType.getSimpleName();
  }

  @Override
  public JavaType typeFromId(DatabindContext context, String id) {
    Class<?> subType;
    try {
      subType = Class.forName("org.vrspace.server.dto." + id);
    } catch (ClassNotFoundException e) {
      throw new IllegalArgumentException("Unknown command " + id, e);
    }
    return context.constructSpecializedType(superType, subType);
  }
}