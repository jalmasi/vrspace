package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.HashSet;
import java.util.Iterator;
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

  ArgumentCaptor<?> message = ArgumentCaptor.forClass(Object.class);

  Set<VRObject> transforms = new HashSet<VRObject>();
  Set<VRObject> permanents = new HashSet<VRObject>();

  @BeforeEach
  public void setUp() throws Exception {
    transforms.add(new VRObject(1L, 0, 0, 0, new VRObject(11L).active()).active());
    transforms.add(new VRObject(2L, 1, 0, 0).passive());

    permanents.add(new VRObject(101L, new VRObject(12L)));
    permanents.add(new VRObject(202L));

    SceneProperties props = new SceneProperties();
    Point pos = new Point();
    lenient().when(client.getSceneProperties()).thenReturn(props);
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
    scene.setDirty();
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
}
