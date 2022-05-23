package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.lang.reflect.Modifier;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.neo4j.core.mapping.Neo4jMappingContext;
import org.springframework.data.util.TypeInformation;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.WorldStatus;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.EventRecorder;
import org.vrspace.server.obj.PersistentEvent;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.Rotation;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;

@SpringBootTest
public class DBTest {

  @Autowired
  VRObjectRepository repo;

  @Autowired
  Neo4jMappingContext ctx;

  @Autowired
  WorldManager worldManager;

  @Autowired
  WriteBack writeBack;

  @Test
  @Transactional
  public void testStoreRetrieve() throws Exception {
    VRObject obj = new VRObject();
    VRObject saved = repo.save(obj);
    System.err.println(saved);
    Optional<VRObject> retrieved = repo.findById(VRObject.class, saved.getId());
    assertTrue(retrieved.isPresent());
    assertEquals(saved, retrieved.get());

    saved.addChildren(new VRObject());
    saved = repo.save(saved);
    System.err.println(saved);
    retrieved = repo.findById(VRObject.class, saved.getId());

    assertTrue(retrieved.isPresent());
    assertEquals(saved, retrieved.get());
    System.err.println(retrieved.get());

    VRObject child = saved.getChildren().get(0);
    Optional<VRObject> retrievedChild = repo.findById(VRObject.class, child.getId());
    System.err.println(retrievedChild.get());

    assertTrue(retrievedChild.isPresent());
    assertEquals(child, retrievedChild.get());

    Client c = new Client();
    c.setName("client 1");
    c = repo.save(c);
    System.err.println(c);

    Optional<Client> found = repo.findById(Client.class, c.getId());
    System.err.println(found);

    assertTrue(found.isPresent());
    assertEquals(c, found.get());
  }

  // regression test for neo4j/spring upgrade
  @Test
  @Transactional
  public void testPointsInRange() throws Exception {
    Point p0 = new Point(0, 0, 0);
    Point p1 = new Point(1, 1, 1);
    Point p2 = new Point(5, 0, 0);

    p0 = repo.save(p0);
    p1 = repo.save(p1);
    p2 = repo.save(p2);

    System.err.println(p0);
    System.err.println(p1);
    System.err.println(p2);

    Set<Point> ret = repo.getPoints(new Point(0, 0, 0), new Point(0, 0, 0));
    System.err.println(ret);
    assertEquals(1, ret.size());

    ret = repo.getPoints(new Point(-1, -1, -1), new Point(1, 1, 1));
    System.err.println(ret);
    assertEquals(2, ret.size());

    ret = repo.getPoints(new Point(-5, -5, -5), new Point(5, 5, 5));
    System.err.println(ret);
    assertEquals(3, ret.size());
  }

  @Test
  @Transactional
  public void testGetRange() throws Exception {
    World world = new World("test");
    world = repo.save(world);
    VRObject o1 = new VRObject(world, 0, 0, 0);
    VRObject o2 = new VRObject(world, 10.0, 0, 0);
    Client c1 = new Client();
    c1.setWorld(world);
    c1.setPosition(new Point(5, 0, 0));
    c1.setScale(new Point(1, 1, 1));

    o1 = repo.save(o1);
    o2 = repo.save(o2);
    c1 = repo.save(c1);

    Set<VRObject> ret = repo.getRange(world.getId(), new Point(-1, -1, -1), new Point(1, 1, 1));
    System.err.println(ret);

    assertEquals(1, ret.size());

    ret = repo.getRange(world.getId(), new Point(-1, -1, -1), new Point(5, 1, 1));
    System.err.println(ret);
    assertEquals(2, ret.size());

    ret = repo.getRange(world.getId(), new Point(-1, -1, -1), new Point(10, 1, 1));
    System.err.println(ret);
    assertEquals(3, ret.size());
  }

  @Test
  @Transactional
  public void testGetWorldRange() throws Exception {
    World world1 = new World("test1");
    world1 = repo.save(world1);
    World world2 = new World("test2");
    world2 = repo.save(world2);

    VRObject o1 = new VRObject(world1, 0, 0, 0);
    VRObject o2 = new VRObject(world1, 10.0, 0, 0);
    VRObject o3 = new VRObject(world2, 10.0, 0, 0);

    o1 = repo.save(o1);
    o2 = repo.save(o2);
    o3 = repo.save(o3);

    Set<VRObject> ret = repo.getRange(world1.getId(), new Point(-1, -1, -1), new Point(1, 1, 1));
    System.err.println(ret);
    assertEquals(1, ret.size());

    ret = repo.getRange(world1.getId(), new Point(-1, -1, -1), new Point(10, 1, 1));
    System.err.println(ret);
    assertEquals(2, ret.size());

    ret = repo.getRange(world2.getId(), new Point(-1, -1, -1), new Point(1, 1, 1));
    System.err.println(ret);
    assertEquals(0, ret.size());

    ret = repo.getRange(world2.getId(), new Point(-1, -1, -1), new Point(10, 1, 1));
    System.err.println(ret);
    assertEquals(1, ret.size());

  }

  @Test
  @Transactional
  public void testGetPermanents() throws Exception {
    World world = new World("test");
    world = repo.save(world);
    VRObject o1 = new VRObject(world);
    o1.setPermanent(true);
    VRObject o2 = new VRObject(world, 10.0, 0, 0);
    o1 = repo.save(o1);
    repo.save(o2);
    Set<VRObject> ret = repo.getPermanents(world.getId());
    System.err.println(ret);

    assertEquals(1, ret.size());
    assertEquals(o1, ret.iterator().next());
  }

  @Test
  @Transactional
  public void testGetWorldPermanents() throws Exception {
    World world1 = new World("test1");
    world1 = repo.save(world1);

    World world2 = new World("test2");
    world2 = repo.save(world2);

    VRObject o1 = new VRObject(world1);
    o1.setPermanent(true);
    o1 = repo.save(o1);

    VRObject o2 = new VRObject(world2);
    o2.setPermanent(true);
    o2 = repo.save(o2);

    Set<VRObject> ret1 = repo.getPermanents(world1.getId());
    System.err.println(ret1);

    assertEquals(1, ret1.size());
    assertEquals(o1, ret1.iterator().next());

    Set<VRObject> ret2 = repo.getPermanents(world2.getId());
    System.err.println(ret2);

    assertEquals(1, ret2.size());
    assertEquals(o2, ret2.iterator().next());
  }

  @Test
  @Transactional
  public void testChangeWorldGetPermanents() throws Exception {
    World world1 = new World("test1");
    world1 = repo.save(world1);

    World world2 = new World("test2");
    world2 = repo.save(world2);

    VRObject o1 = new VRObject(world1);
    o1.setPermanent(true);
    o1 = repo.save(o1);

    // now o1 is in world1, but not in world2
    Set<VRObject> ret1 = repo.getPermanents(world1.getId());
    Set<VRObject> ret2 = repo.getPermanents(world2.getId());
    assertEquals(1, ret1.size());
    assertEquals(0, ret2.size());

    o1.setWorld(world2);
    o1 = repo.save(o1);

    // now o1 is not in world1, but is in world2
    ret1 = repo.getPermanents(world1.getId());
    ret2 = repo.getPermanents(world2.getId());
    assertEquals(0, ret1.size());
    assertEquals(1, ret2.size());

  }

  @Test
  @Transactional
  public void testChangeWorldGetRange() throws Exception {
    World world1 = new World("test1");
    world1 = repo.save(world1);
    World world2 = new World("test2");
    world2 = repo.save(world2);

    VRObject o1 = new VRObject(world1, 0, 0, 0);
    VRObject o2 = new VRObject(world1, 10.0, 0, 0);
    VRObject o3 = new VRObject(world2, 10.0, 0, 0);

    o1 = repo.save(o1);
    o2 = repo.save(o2);
    o3 = repo.save(o3);

    Point from = new Point(-10, -10, -10);
    Point to = new Point(10, 10, 10);

    // 2 in world1, 1 in world2
    Set<VRObject> ret = repo.getRange(world1.getId(), from, to);
    assertEquals(2, ret.size());

    ret = repo.getRange(world2.getId(), from, to);
    assertEquals(1, ret.size());

    // move o2 to world2
    o2.setWorld(world2);
    o2 = repo.save(o2);

    ret = repo.getRange(world1.getId(), from, to);
    assertEquals(1, ret.size());

    ret = repo.getRange(world2.getId(), from, to);
    assertEquals(2, ret.size());

  }

  @Test
  @Transactional
  public void testGet() throws Exception {
    VRObject o1 = new VRObject();
    VRObject o2 = new VRObject();
    Client c1 = new Client();

    repo.save(o1);
    repo.save(o2);
    c1 = repo.save(c1);

    // VRObject ret = repo.get(VRObject.class, c1.getId());
    // System.err.println(ret);
    // assertEquals(c1, ret);

    Client found = repo.get(Client.class, c1.getId());
    System.err.println(found);
    assertEquals(c1, found);
  }

  @Test
  @Transactional
  public void testGetClient() throws Exception {

    Client c1 = new Client();
    c1.setName("clientOne");
    c1.setScene(new Scene());
    c1.addChildren(new VRObject());

    Client c2 = new Client();
    c2.setName("clientTwo");
    c2.setScene(new Scene());
    c2.addListener(c1);

    c1 = repo.save(c1);
    c2 = repo.save(c2);

    System.err.println(c1);
    System.err.println(c2);

    Client c = repo.getClientByName("clientOne");
    System.err.println(c);

    assertEquals(c1, c);

    assertNotNull(c.getChildren(), "null children");
    assertEquals(1, c.getChildren().size(), "no children");

    c = repo.getClientByName("clientTwo");
    System.err.println(c);
    assertEquals(c2, c);

  }

  @Test
  @Transactional
  public void testObjectProperties() {
    VRObject obj = new VRObject();
    Map<String, Object> properties = new HashMap<>();
    properties.put("string", "string");
    properties.put("long", 1L);
    properties.put("float", 1.2);
    obj.setProperties(properties);
    obj = repo.save(obj);
    System.err.println(obj);
    assertEquals(properties, obj.getProperties());
  }

  @Test
  @Transactional
  public void testRotation() throws Exception {
    VRObject o = new VRObject().active();
    Rotation r = new Rotation(1, 2, 3, 4);
    o.setRotation(r);
    o = repo.save(o);
    System.err.println(o);
    o = repo.get(VRObject.class, o.getId());

    System.err.println(o);
    assertEquals(1, o.getRotation().getX(), 0.01);
    assertEquals(2, o.getRotation().getY(), 0.01);
    assertEquals(3, o.getRotation().getZ(), 0.01);
    assertEquals(4, o.getRotation().getAngle(), 0.01);
  }

  @Test
  @Transactional
  public void testUniqueIndex() throws Exception {
    repo.save(new Client("test"));
    assertThrows(DataIntegrityViolationException.class, () -> repo.save(new Client("test")));
  }

  @Test
  @Transactional
  public void testCascadeDelete() throws Exception {
    Client c = new Client();
    c.setPosition(new Point());
    c.addOwned(new VRObject());
    c.addChildren(new VRObject());

    c = repo.save(c);
    System.err.println(c);

    Long pointId = c.getPosition().getId();
    Long ownedId = c.getOwned().iterator().next().getId();
    Long childId = c.getChildren().get(0).getId();

    assertTrue(repo.findById(Point.class, pointId).isPresent());
    assertTrue(repo.findById(VRObject.class, ownedId).isPresent());
    assertTrue(repo.findById(VRObject.class, childId).isPresent());

    repo.delete(c);

    assertFalse(repo.findById(Point.class, pointId).isPresent());
    assertTrue(repo.findById(VRObject.class, ownedId).isPresent());
    assertTrue(repo.findById(VRObject.class, childId).isPresent());
  }

  @Test
  @Transactional
  public void testEventRecorder() throws Exception {
    EventRecorder recorder = new EventRecorder();
    recorder.setRecording(true);
    VREvent event = new VREvent(new Client());
    event.addChange("something", "anything");
    event.setPayload("{\"something\":\"anything\"}");
    recorder.sendMessage(event);
    recorder = repo.save(recorder);

    EventRecorder found = repo.get(EventRecorder.class, recorder.getId());
    assertEquals(recorder, found);
    assertNotNull(recorder.getEvents());
    assertTrue(recorder.getEvents().iterator().hasNext());

    PersistentEvent stored = recorder.getEvents().iterator().next();
    assertNotNull(stored);
    assertNotNull(stored.getId());
    assertEquals(event.getPayload(), stored.getPayload());
  }

  // CHECKME: better place to test mapping
  @Test
  public void testMetadata() throws Exception {
    List<Class<?>> classes = worldManager.listClasses();
    System.err.println(classes);

    assertNotNull(classes);
    assertTrue(classes.size() > 0);

    Collection<TypeInformation<?>> types = ctx.getManagedTypes();
    System.err.println(types);
    for (TypeInformation<?> type : types) {
      Class<?> c = type.getType();
      if (!Modifier.isAbstract(c.getModifiers())) {
        classes.remove(c);
      }
    }

    assertEquals(0, classes.size());
  }

  @Test
  @Transactional
  @Disabled("Tests nothing, just prints out timing to be compared with writeback")
  public void testTiming() throws Exception {
    VRObject o = new VRObject(0, 0, 0);
    long start = System.currentTimeMillis();
    int total = 1000;
    for (int i = 0; i < total; i++) {
      long time = System.currentTimeMillis();
      o.getPosition().setX(i);
      repo.save(o);
      System.err.println("saved in " + (System.currentTimeMillis() - time) + " ms");
    }
    System.err.println("rate " + total * 1000.0 / (System.currentTimeMillis() - start) + "/s");
  }

  @Test
  @Transactional
  public void testWriteback() throws Exception {
    assertThrows(IllegalArgumentException.class, () -> writeBack.write(new VRObject(0, 0, 0)));

    VRObject o1 = repo.save(new VRObject(0, 0, 0));
    VRObject o2 = repo.save(new VRObject(0, 0, 0));

    writeBack.write(o1);
    waitFor(1000);
    assertEquals(0, writeBack.size());
    assertEquals(1L, writeBack.writes());

    long start = System.currentTimeMillis();
    int total = 10000;
    for (int i = 0; i < total; i++) {
      o1.getPosition().setX(i);
      o2.getPosition().setY(i);
      writeBack.write(o1);
      writeBack.write(o2);
    }
    waitFor(writeBack.getDelay());
    writeBack.flush();
    assertEquals(0, writeBack.size());
    System.err.println("update rate " + writeBack.writeRequests() * 1000.0 / (System.currentTimeMillis() - start)
        + "/s, writes " + writeBack.writes());

    long writes = writeBack.writes();
    VRObject o3 = repo.save(new VRObject(0, 0, 0));
    writeBack.write(o3);
    writeBack.delete(o3);
    waitFor(1000);
    assertEquals(writes, writeBack.writes());

  }

  private void waitFor(long millis) throws Exception {
    int sleep = 10;
    int count = 0;
    while (writeBack.size() > 0 && ++count < millis / sleep) {
      Thread.sleep(sleep);
    }
  }

  @Test
  @Transactional
  public void testWorlds() {
    World w1 = repo.save(new World("one"));
    World w2 = repo.save(new World("two"));
    repo.save(new VRObject());
    repo.save(new Client("aClient"));
    List<World> worlds = repo.listWorlds();
    assertEquals(2, worlds.size());
    assertTrue(worlds.contains(w1));
    assertTrue(worlds.contains(w2));
  }

  @Test
  @Transactional
  public void testCountUsers() {
    World w1 = repo.save(new World("one"));
    World w2 = repo.save(new World("two"));

    Client c1 = new Client();
    c1.setWorld(w1);
    c1.setActive(true);
    repo.save(c1);

    Client c2 = new Client();
    c2.setWorld(w1);
    c2.setActive(false);
    repo.save(c2);

    int total = repo.countUsers(w1.getId());
    assertEquals(2, total);

    int active = repo.countUsers(w1.getId(), true);
    assertEquals(1, active);

    int inactive = repo.countUsers(w1.getId(), false);
    assertEquals(1, inactive);

    int empty = repo.countUsers(w2.getId());
    assertEquals(0, empty);

    Collection<WorldStatus> stats = repo.countUsers();
    System.err.println(stats);
    assertEquals(2, stats.size());
    for (WorldStatus stat : stats) {
      if ("one".equals(stat.getWorldName())) {
        assertEquals(1, stat.getActiveUsers());
        assertEquals(2, stat.getTotalUsers());
      } else if ("two".equals(stat.getWorldName())) {
        assertEquals(0, stat.getActiveUsers());
        assertEquals(0, stat.getTotalUsers());
      } else {
        fail("Invalid stats: " + stats);
      }
    }
  }

  @Test
  @Transactional
  public void testOwned() {
    // client owns an object:
    Client c1 = new Client();
    c1 = repo.save(c1);
    VRObject o1 = new VRObject();
    o1.setPosition(new Point(1, 2, 3));
    o1.setScale(new Point(4, 5, 6));
    o1.setRotation(new Rotation(7, 8, 9, 0));
    c1.addOwned(o1);
    c1 = repo.save(c1);
    System.err.println(c1);
    System.err.println(o1);

    // confirm owned object persist along with client:
    Client result = repo.getClient(c1.getId());
    System.err.println(result);
    VRObject owned = result.getOwned().iterator().next();
    System.err.println(owned);
    assertEquals(o1, owned);
    assertEquals(o1.getPosition(), owned.getPosition());
    assertEquals(o1.getRotation(), owned.getRotation());
    assertEquals(o1.getScale(), owned.getScale());

    // change the object:
    o1.getPosition().setX(11);
    o1.setScale(new Point(1, 1, 1));
    o1.getRotation().setAngle(1);
    o1 = repo.save(o1);
    System.err.println(o1);

    result.addOwned(o1);
    // note that old result contains old copy of old object
    System.err.println(result);
    // ensure the the changes took:
    Client newResult = repo.getClient(c1.getId());
    System.err.println(newResult);
    VRObject newOwned = newResult.getOwned().iterator().next();
    assertEquals(o1, newOwned);
    assertEquals(o1.getPosition(), newOwned.getPosition());
    assertEquals(o1.getRotation(), newOwned.getRotation());
    assertEquals(o1.getScale(), newOwned.getScale());
  }
}
