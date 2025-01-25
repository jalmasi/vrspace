package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.Filter;
import org.vrspace.server.types.ID;

@ExtendWith(MockitoExtension.class)
public class SceneTest {

  @Mock
  WorldManager world;

  @Mock
  Client client;

  SceneProperties sceneProperties = new SceneProperties();

  ArgumentCaptor<?> message = ArgumentCaptor.forClass(Object.class);

  Set<VRObject> transforms = new HashSet<VRObject>();
  Set<VRObject> permanents = new HashSet<VRObject>();

  @BeforeEach
  public void setUp() throws Exception {
    transforms.add(new VRObject(1L, 0, 0, 0, new VRObject(11L).active()).active());
    transforms.add(new VRObject(2L, 1, 0, 0).passive());

    permanents.add(new VRObject(101L, new VRObject(12L)));
    permanents.add(new VRObject(202L));

    Point pos = new Point();
    lenient().when(client.getSceneProperties()).thenReturn(sceneProperties);
    lenient().when(client.getPosition()).thenReturn(pos);
    lenient().when(world.getRange(any(Client.class), any(Point.class), any(Point.class))).thenReturn(transforms);
    lenient().when(world.getPermanents(any(Client.class))).thenReturn(permanents);

    lenient().doNothing().when(client).sendMessage(message.capture());
  }

  @Test
  public void testAddRemove() throws Exception {

    // build new scene
    Scene scene = new Scene(world, client);
    verify(client, times(0)).sendMessage(any(Object.class));
    scene.update();

    // verify client got Add message for members
    verify(client, times(1)).sendMessage(any(Add.class));
    Add add = (Add) message.getValue();

    System.err.println(add);

    // verify Add contains expected elements
    assertNotNull(add.getObjects());
    assertEquals(2, add.getObjects().size());

    VRObject t = add.getObjects().get(0);
    assertEquals(Long.valueOf(1), t.getId());

    assertNotNull(t.getChildren());
    assertEquals(1, t.getChildren().size());
    assertEquals(Long.valueOf(11), t.getChildren().get(0).getId());

    assertEquals(Long.valueOf(2), add.getObjects().get(1).getId());

    // verify that client is event listener on parent and child
    assertNotNull(t.getListeners());
    assertNotNull(t.getChildren().get(0).getListeners());
    assertEquals(1, t.getListeners().size());
    assertEquals(1, t.getChildren().get(0).getListeners().size());
    assertEquals(client, t.getListeners().values().iterator().next());
    assertEquals(client, t.getChildren().get(0).getListeners().values().iterator().next());

    // verify that client is not listener on passive object
    assertNull(add.getObjects().get(1).getListeners());
    // assertEquals(0, add.getObjects().get(1).getListeners().size());

    // move transform out of sight - check disabled in scene
    // t.getPosition().setX(2 * scene.props.getRange());
    transforms.remove(t);

    // verify scene does not update
    scene.update();
    verify(client, times(1)).sendMessage(any(Object.class));

    // update scene
    scene.dirty();
    scene.update();

    // verify client got remove message
    verify(client, times(2)).sendMessage(any(Object.class));
    verify(client, times(1)).sendMessage(any(Remove.class));
    Remove remove = (Remove) message.getValue();

    System.err.println(remove);

    // verify Remove contains expected elements
    assertNotNull(remove.getObjects());
    assertEquals(2, remove.getObjects().size());

    Iterator<Map<String, Long>> it = remove.getObjects().iterator();
    ID first = new ID(it.next());

    // verify order of elements (transform comes last)
    assertEquals("VRObject", first.getClassName());
    assertEquals(Long.valueOf(11), first.getId());

    ID last = new ID(it.next());
    assertEquals("VRObject", last.getClassName());
    assertEquals(Long.valueOf(1), last.getId());

    // verify that client is NOT event listener on transform and child
    assertNotNull(t.getListeners());
    assertNotNull(t.getChildren().get(0).getListeners());
    assertEquals(0, t.getListeners().size());
    assertEquals(0, t.getChildren().get(0).getListeners().size());
  }

  @Test
  public void testReload() throws Exception {

    // build new scene
    Scene scene = new Scene(world, client);
    verify(client, times(0)).sendMessage(any(Object.class));
    scene.update();

    // verify client got Add message for members
    verify(client, times(1)).sendMessage(any(Add.class));
    Add add = (Add) message.getValue();

    System.err.println(add);

    scene.removeAll();

    // verify remove message, scene should be empty
    verify(client, times(1)).sendMessage(any(Remove.class));
    Remove remove = (Remove) message.getValue();
    System.err.println(remove);

    assertEquals(3, remove.getObjects().size());
    assertEquals(0, scene.size());

    // update the scene, should be the same
    scene.update();

    verify(client, times(2)).sendMessage(any(Add.class));
    Add add2 = (Add) message.getValue();

    System.err.println(add2);

    assertEquals(add, add2);

  }

  @Test
  public void testGetClosestEmpty() throws Exception {
    Scene scene = new Scene(world, client);
    assertThrows(NoSuchElementException.class, () -> scene.getClosest(0, 0, 0));
  }

  @Test
  public void testGetClosest() throws Exception {
    Scene scene = new Scene(world, client);
    scene.update();
    VRObject closest = scene.getClosest(0, 0, 0);
    assertEquals(Long.valueOf(1), closest.getId());
    closest = scene.getClosest(2, 0, 0);
    assertEquals(Long.valueOf(2), closest.getId());
    assertNotNull(closest.getPosition());
  }

  @Test
  public void testFilter() throws Exception {
    Scene scene = new Scene(world, client);
    scene.update();
    assertEquals(2, scene.size());

    scene.addFilter("test", Filter.isActive());
    scene.update();
    assertEquals(1, scene.size());

    scene.removeFilter("test");
    scene.update();
    assertEquals(2, scene.size());
  }

  @Test
  public void testOfferSingle() throws Exception {
    Scene scene = new Scene(world, client);
    scene.update();
    assertEquals(2, scene.size());
    assertEquals(2, scene.permanents.size());

    VRObject permanent = new VRObject(10L);
    permanent.setPermanent(true);
    scene.offer(permanent);
    assertEquals(2, scene.size());
    assertEquals(3, scene.permanents.size());

    // object without position
    VRObject noPos = new VRObject(11L);
    scene.offer(noPos);
    assertEquals(3, scene.size());

    // object with position in range
    VRObject withPos = new VRObject(12L);
    withPos.setPosition(
        new Point(sceneProperties.getRange() - .1, sceneProperties.getRange() - .1, sceneProperties.getRange() - .1));
    scene.offer(withPos);
    assertEquals(4, scene.size());

    // object with position out of range
    VRObject outOfRange = new VRObject(13L);
    outOfRange.setPosition(
        new Point(sceneProperties.getRange() + .1, sceneProperties.getRange() + .1, sceneProperties.getRange() + .1));
    scene.offer(outOfRange);
    assertEquals(4, scene.size());

  }

  @Test
  public void testOfferCollection() throws Exception {
    Scene scene = new Scene(world, client);
    scene.update();
    assertEquals(2, scene.size());
    assertEquals(2, scene.permanents.size());

    VRObject permanent = new VRObject(10L);
    permanent.setPermanent(true);
    // object without position
    VRObject noPos = new VRObject(11L);

    // object with position in range
    VRObject withPos = new VRObject(12L);
    withPos.setPosition(
        new Point(sceneProperties.getRange() - .1, sceneProperties.getRange() - .1, sceneProperties.getRange() - .1));

    // object with position out of range
    VRObject outOfRange = new VRObject(13L);
    outOfRange.setPosition(
        new Point(sceneProperties.getRange() + .1, sceneProperties.getRange() + .1, sceneProperties.getRange() + .1));

    scene.offer(List.of(permanent, noPos, withPos, outOfRange));
    assertEquals(4, scene.size());
    assertEquals(3, scene.permanents.size());
  }

  @Test
  public void testPublish() throws Exception {
    Scene scene = new Scene(world, client);
    scene.update();
    assertEquals(2, scene.size());

    Client c2 = spy(new Client());
    lenient().doNothing().when(c2).sendMessage(any());
    c2.setSceneProperties(sceneProperties);
    c2.setPosition(new Point());
    c2.setScene(new Scene(world, c2));
    c2.getScene().update();
    assertEquals(2, scene.size());

    // clients see each other
    scene.offer(c2);
    assertEquals(3, scene.size());
    c2.getScene().offer(client);
    assertEquals(3, c2.getScene().size());

    VRObject newOne = new VRObject(123L);
    scene.publish(newOne);
    // and newly published object is in both scenes
    assertEquals(4, scene.size());
    assertEquals(4, c2.getScene().size());

    // the same with collection
    VRObject anotherNew = new VRObject(1234L);
    scene.publishAll(List.of(anotherNew));
    assertEquals(5, scene.size());
    assertEquals(5, c2.getScene().size());

    // unpublish, confirm removed from both scenes
    scene.unpublish(anotherNew);
    assertEquals(4, scene.size());
    assertEquals(4, c2.getScene().size());

    scene.unpublish(List.of(newOne));
    assertEquals(3, scene.size());
    assertEquals(3, c2.getScene().size());

    scene.logout();
    assertEquals(2, c2.getScene().size());

  }

}
