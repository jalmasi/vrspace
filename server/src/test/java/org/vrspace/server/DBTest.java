package org.vrspace.server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.Optional;
import java.util.Set;

import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.MethodSorters;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.Rotation;
import org.vrspace.server.obj.VRObject;

@SpringBootTest
@RunWith(SpringRunner.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class DBTest {

  @Autowired
  VRObjectRepository repo;

  @Test
  @Transactional
  public void testStoreRetrieve() throws Exception {
    VRObject obj = new VRObject();
    VRObject saved = repo.save(obj);
    System.err.println(saved);
    Optional<Entity> retrieved = repo.findById(saved.getId());
    assertTrue(retrieved.isPresent());
    assertEquals(saved, retrieved.get());

    saved.addChildren(new VRObject());
    saved = repo.save(saved);
    System.err.println(saved);
    retrieved = repo.findById(saved.getId());

    assertTrue(retrieved.isPresent());
    assertEquals(saved, retrieved.get());
    System.err.println(retrieved.get());

    VRObject child = saved.getChildren().get(0);
    Optional<Entity> retrievedChild = repo.findById(child.getId());
    System.err.println(retrievedChild.get());

    assertTrue(retrievedChild.isPresent());
    assertEquals(child, retrievedChild.get());

    Client c = new Client();
    c.setName("client 1");
    c = repo.save(c);
    System.err.println(c);

    Optional<Entity> found = repo.findById(c.getId());
    System.err.println(found);

    assertTrue(found.isPresent());
    assertEquals(c, found.get());
  }

  @Test
  @Transactional
  public void testGetRange() throws Exception {
    VRObject o1 = new VRObject(0, 0, 0);
    VRObject o2 = new VRObject(10.0, 0, 0);
    Client c1 = new Client();
    c1.setPosition(new Point(5, 0, 0));
    c1.setScale(new Point(1, 1, 1));

    o1 = repo.save(o1);
    o2 = repo.save(o2);
    c1 = repo.save(c1);

    Set<VRObject> ret = repo.getRange(new Point(-1, -1, -1), new Point(1, 1, 1));
    System.err.println(ret);

    assertEquals(1, ret.size());

    ret = repo.getRange(new Point(-1, -1, -1), new Point(5, 1, 1));
    System.err.println(ret);
    assertEquals(2, ret.size());

    ret = repo.getRange(new Point(-1, -1, -1), new Point(10, 1, 1));
    System.err.println(ret);
    assertEquals(3, ret.size());
  }

  @Test
  @Transactional
  public void testGetPermanents() throws Exception {
    VRObject o1 = new VRObject();
    o1.setPermanent(true);
    VRObject o2 = new VRObject(10.0, 0, 0);
    o1 = repo.save(o1);
    repo.save(o2);
    Set<VRObject> ret = repo.getPermanents();
    System.err.println(ret);

    assertEquals(1, ret.size());
    assertEquals(o1, ret.iterator().next());
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

    // tran = session.beginTransaction();
    Client c = repo.getClientByName("clientOne");
    System.err.println(c);
    assertEquals(c1, c);

    assertNotNull(c.getChildren());
    assertEquals(1, c.getChildren().size());

    c = repo.getClientByName("clientTwo");
    System.err.println(c);
    assertEquals(c2, c);

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

  @Test(expected = DataIntegrityViolationException.class)
  @Transactional
  public void testUniqueIndex() throws Exception {
    repo.save(new Client("test"));
    repo.save(new Client("test"));
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

    assertTrue(repo.findById(pointId).isPresent());
    assertTrue(repo.findById(ownedId).isPresent());
    assertTrue(repo.findById(childId).isPresent());

    repo.delete(c);

    assertFalse(repo.findById(pointId).isPresent());
    assertTrue(repo.findById(ownedId).isPresent());
    assertTrue(repo.findById(childId).isPresent());
  }

}
