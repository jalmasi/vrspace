package org.vrspace.server;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Set;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.data.neo4j.annotation.Query;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.util.StringUtils;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Embedded;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;

/**
 * https://docs.spring.io/spring-data/neo4j/docs/current/reference/html/#neo4j.repositories
 */
public interface VRObjectRepository extends Neo4jRepository<Entity, Long> {
  static final Log LOG = LogFactory.getLog(VRObjectRepository.class);

  @Query("MATCH (o:VRObject) WHERE o.permanent RETURN o")
  Set<VRObject> getPermanents();

  @Query("MATCH (o:Entity) WHERE ID(o) = {id} RETURN *")
  <T extends Entity> T get(Class<T> cls, Long id);

  @Query("MATCH (o:Client) WHERE o.name = {name} RETURN o")
  Client getClientByName(String name);

  @Query("MATCH (o:VRObject)-[r:HAS_POSITION]->(p:Point) WHERE p.x >= {from}.x AND p.y >= {from}.y AND p.z >= {from}.z AND p.x <= {to}.x AND p.y <= {to}.y AND p.z <= {to}.z RETURN o,r,p")
  Set<VRObject> getRange(Point from, Point to);

  @Query("MATCH (o:Entity) WHERE ID(o) = {id} RETURN o")
  <T extends Embedded> T getMember(Class<T> cls, Long id);

  default void delete(VRObject o) {
    try {
      deleteMembers(o.getClass(), o);
    } catch (Exception e) {
      LOG.error("Cannot delete members of " + o.getClass().getSimpleName() + " " + o.getId(), e);
    }
    deleteById(o.getId());
  }

  default void deleteMembers(Class<?> cls, VRObject obj) throws NoSuchMethodException, SecurityException,
      IllegalAccessException, IllegalArgumentException, InvocationTargetException {
    if (VRObject.class.isAssignableFrom(cls.getSuperclass())) {
      deleteMembers(cls.getSuperclass(), obj);
    }
    for (Field f : cls.getDeclaredFields()) {
      if (Embedded.class.isAssignableFrom(f.getType())) {
        Method getter = cls.getMethod("get" + StringUtils.capitalize(f.getName()));
        Embedded e = (Embedded) getter.invoke(obj);
        if (e != null && e.getId() != null) {
          LOG.debug("Deleting " + f.getName() + " of " + obj.getClass().getSimpleName() + " " + obj.getId());
          deleteById(e.getId());
        }
      }
    }
  }

  default void nullSafeDelete(Entity e) {
    if (e != null && e.getId() != null) {
      deleteById(e.getId());
    }
  }
}