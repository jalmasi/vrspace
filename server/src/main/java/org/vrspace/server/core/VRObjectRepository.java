package org.vrspace.server.core;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.neo4j.annotation.Query;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.util.StringUtils;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Embedded;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;

/**
 * https://docs.spring.io/spring-data/neo4j/docs/current/reference/html/#neo4j.repositories
 */
public interface VRObjectRepository extends Neo4jRepository<Entity, Long> {
  static final Logger log = LoggerFactory.getLogger(VRObjectRepository.class);

  @Query("MATCH (o:VRObject{permanent:true})-[r:IN_WORLD]->(w:World) WHERE ID(w)=$worldId RETURN o")
  Set<VRObject> getPermanents(Long worldId);

  @Query("MATCH (o:Entity) WHERE ID(o) = $id RETURN *")
  <T extends Entity> T get(Class<T> cls, Long id);

  @Query("MATCH (o:Client) WHERE o.name = $name RETURN o")
  Client getClientByName(String name);

  @Query("MATCH (o:World) WHERE o.name = $name RETURN o")
  World getWorldByName(String name);

  @Query("MATCH (w:World)<-[i:IN_WORLD]-(o:VRObject)-[r:HAS_POSITION]->(p:Point) WHERE ID(w) = $worldId AND p.x >= $from.x AND p.y >= $from.y AND p.z >= $from.z AND p.x <= $to.x AND p.y <= $to.y AND p.z <= $to.z RETURN o,r,p,i,w")
  Set<VRObject> getRange(Long worldId, Point from, Point to);

  @Query("MATCH (o:Entity) WHERE ID(o) = $id RETURN o")
  <T extends Embedded> T getMember(Class<T> cls, Long id);

  default void delete(VRObject o) {
    try {
      deleteMembers(o.getClass(), o);
    } catch (Exception e) {
      log.error("Cannot delete members of " + o.getClass().getSimpleName() + " " + o.getId(), e);
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
          log.debug("Deleting " + f.getName() + " of " + obj.getClass().getSimpleName() + " " + obj.getId());
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