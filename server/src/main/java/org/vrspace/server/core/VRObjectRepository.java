package org.vrspace.server.core;

import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.util.StringUtils;
import org.vrspace.server.dto.WorldStatus;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.ContentCategory;
import org.vrspace.server.obj.Embedded;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.GltfModel;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.TerrainPoint;
import org.vrspace.server.obj.UserData;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.WebPushSubscription;
import org.vrspace.server.obj.World;

@DependsOn({ "database" })
/**
 * https://docs.spring.io/spring-data/neo4j/docs/current/reference/html/#neo4j.repositories
 */
public interface VRObjectRepository extends Neo4jRepository<Entity, Long>, VRSpaceDB {
  static final Logger log = LoggerFactory.getLogger(VRObjectRepository.class);

  @Override
  default Optional<Entity> findById(Long id) {
    throw new UnsupportedOperationException("This doesn't work, use findById(Class<T> cls, Long id) instead");
  }

  @Override
  default void deleteById(Long id) {
    throw new UnsupportedOperationException("This doesn't work, use deleteById(Class<T> cls, Long id) instead");
  }

  // this returns shallow object - does not retrieve members
  @Query("MATCH (o:VRObject{permanent:true}) WHERE o.worldId=$worldId RETURN o")
  Set<VRObject> getPermanents(Long worldId);

  // default Set<VRObject> getPermanents(Long worldId) {
  // return _getPermanents(worldId).stream().map(o -> get(o.getClass(),
  // o.getId())).collect(Collectors.toSet());
  // }

  // this returns shallow object - does not retrieve members
  // @Query("MATCH (o) WHERE ID(o) = $id RETURN *")
  // <T extends Entity> T get(Long id);

  default Client getClient(Long id) {
    return get(Client.class, id);
  }

  // @Query("MATCH (o:Client) WHERE o.name = $name RETURN *")
  // Client getClientByName(String name);

  @Query("MATCH (o:VRObject) WHERE o.worldId = $worldId RETURN o")
  Set<VRObject> getAllInWorld(Long worldId);

  default void deleteWorld(World world) {
    Set<VRObject> objects = getAllInWorld(world.getId());
    objects.forEach(o -> delete(o));
    deleteById(world.getClass(), world.getId());
  }

  @Query("MATCH (o:World) WHERE o.name = $name RETURN o")
  World getWorldByName(String name);

  default Set<VRObject> getRange(Long worldId, Point from, Point to) {
    return getRange(worldId, from.getX(), from.getY(), from.getZ(), to.getX(), to.getY(), to.getZ());
  }

  @Query("MATCH (o:VRObject)-[r:HAS_POSITION]->(p:Point) WHERE o.worldId = $worldId AND p.x >= $x1 AND p.y >= $y1 AND p.z >= $z1 AND p.x <= $x2 AND p.y <= $y2 AND p.z <= $z2 RETURN o,r,p")
  Set<VRObject> getRange(Long worldId, double x1, double y1, double z1, double x2, double y2, double z2);

  default Set<Point> getPoints(Point from, Point to) {
    return getPoints(from.getX(), from.getY(), from.getZ(), to.getX(), to.getY(), to.getZ());
  }

  @Query("MATCH (p:Point) WHERE p.x >= $x1 AND p.y >= $y1 AND p.z >= $z1 AND p.x <= $x2 AND p.y <= $y2 AND p.z <= $z2 RETURN p")
  Set<Point> getPoints(double x1, double y1, double z1, double x2, double y2, double z2);

  @Query("MATCH (o:Entity) WHERE ID(o) = $id RETURN o")
  <T extends Embedded> T getMember(Class<T> cls, Long id);

  default void delete(VRObject o) {
    try {
      deleteMembers(o.getClass(), o);
      o.dispose();
      listUserData(o.getId()).forEach(data -> delete(data));
      if (o instanceof Client) {
        listSubscriptions(o.getId()).forEach(sub -> delete(sub));
      }
    } catch (Exception e) {
      log.error("Cannot delete members of " + o.getClass().getSimpleName() + " " + o.getId(), e);
    }
    deleteById(o.getClass(), o.getId());
    log.debug("Deleted " + o.getClass().getSimpleName() + " " + o.getId());
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
          log.debug("Deleting " + f.getName() + " " + e.getClass().getSimpleName() + ":" + e.getId() + " of "
              + obj.getClass().getSimpleName() + " " + obj.getId());
          deleteById(e.getClass(), e.getId());
          e.dispose();
        }
      }
    }
  }

  // CHECKME: doesn't seem used anywhere
  default void nullSafeDelete(Entity e) {
    if (e != null && e.getId() != null) {
      deleteById(e.getClass(), e.getId());
    }
  }

  Optional<GltfModel> findGltfModelByUid(String uid);

  Optional<ContentCategory> findContentCategoryByName(String name);

  @Query("MATCH (o:World) RETURN o")
  List<World> listWorlds();

  // CHECKME this actually counts Client rather than User instances
  @Query("MATCH (o:Client) WHERE o.worldId = $worldId RETURN count(*)")
  int countUsers(long worldId);

  // CHECKME this actually counts Client rather than User instances
  @Query("MATCH (o:Client) WHERE o.worldId = $worldId AND o.active = $active RETURN count(*)")
  int countUsers(long worldId, boolean active);

  // queries like this just do not work
  // @Query("MATCH (o:Client)-[i:IN_WORLD]->(w:World) RETURN w.name AS name,
  // o.active AS active, count(*) as COUNT")
  // see
  // https://community.neo4j.com/t/issue-when-retrieving-result-from-neo4jrepository/34966/6
  // workaround is multitude of queries
  default List<WorldStatus> countUsers() {
    ArrayList<WorldStatus> ret = new ArrayList<>();
    for (World world : listWorlds()) {
      WorldStatus status = new WorldStatus();
      status.setWorldName(world.getName());
      status.setTotalUsers(countUsers(world.getId()));
      status.setActiveUsers(countUsers(world.getId(), true));
      ret.add(status);
    }
    return ret;
  }

  /**
   * WARNING this doesn't return full, useful owned VRObject - position and other
   * members are missing - use listOwnedObjects instead
   * 
   * @param clientId
   * @return list of all ownerships
   */
  @Query("MATCH (obj:Entity)<-[owned:IS_OWNED]-(o:Ownership)-[owns:IS_OWNER]->(c:Client)"
      + " WHERE ID(c) = $clientId RETURN o,owns,c,owned,obj")
  List<Ownership> getOwnedObjects(long clientId);

  default List<Ownership> listOwnedObjects(long ownerId) {
    List<Ownership> ret = new ArrayList<>();
    for (Ownership o : getOwnedObjects(ownerId)) {
      ret.add(get(Ownership.class, o.getId()));
    }
    return ret;
  }

  /**
   * WARNING this doesn't return full, useful owned Entity - position and other
   * members are missing - use getOwners instead
   * 
   * @return list of all owners
   */
  @Query("MATCH (obj:Entity)<-[owned:IS_OWNED]-(o:Ownership)-[owns:IS_OWNER]->(c:Client)"
      + " WHERE ID(obj) = $objectId RETURN o,owns,c,owned,obj")
  List<Ownership> getOwnersOf(long objectId);

  default List<Ownership> getOwners(long objectId) {
    List<Ownership> ret = new ArrayList<>();
    for (Ownership o : getOwnersOf(objectId)) {
      ret.add(get(Ownership.class, o.getId()));
    }
    return ret;
  }

  /**
   * WARNING this doesn't return full, useful owned Entity - e.g. VRObject
   * position and other members are missing - use getOwnership instead
   */
  @Query("MATCH (obj:Entity)<-[owned:IS_OWNED]-(o:Ownership)-[owns:IS_OWNER]->(c:Client)"
      + " WHERE ID(c) = $ownerId AND ID(obj) = $ownedId RETURN o,owns,c,owned,obj")
  Optional<Ownership> findOwnership(long ownerId, long ownedId);

  default Ownership getOwnership(long ownerId, long ownedId) {
    Optional<Ownership> optOwnership = findOwnership(ownerId, ownedId);
    if (optOwnership.isPresent()) {
      return get(Ownership.class, optOwnership.get().getId());
    }
    return null;
  }

  @Query("MATCH (tp:TerrainPoint)-[r:IS_POINT_OF]->(t:Terrain) WHERE ID(t)=$terrainId RETURN tp")
  Set<TerrainPoint> getTerrainPoints(Long terrainId);

  @Query("MATCH (tp:TerrainPoint)-[r:IS_POINT_OF]->(t:Terrain) WHERE ID(t)=$terrainId and tp.index=$index RETURN tp")
  TerrainPoint getTerrainPoint(Long terrainId, Long index);

  @Query("MATCH (ud:UserData)-[r:USER_DATA]->(o:VRObject) WHERE ID(o)=$objectId RETURN ud, r, o")
  List<UserData> listUserData(long objectId);

  @Query("MATCH (ud:UserData)-[r:USER_DATA]->(o:VRObject) WHERE ID(o)=$objectId AND ud.key=$key RETURN ud, r, o")
  Optional<UserData> findUserData(long objectId, String key);

  @Query("MATCH (wps:WebPushSubscription)-[sc:SUBSCRIBED_CLIENT]->(c:Client) WHERE ID(c)=$clientId RETURN wps, sc, c")
  List<WebPushSubscription> listSubscriptions(long clientId);

}