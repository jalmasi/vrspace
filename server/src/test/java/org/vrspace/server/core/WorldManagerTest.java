package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;

@ExtendWith(MockitoExtension.class)
public class WorldManagerTest {

  @Mock
  private ConcurrentWebSocketSessionDecorator session;

  @Mock
  private VRObjectRepository repo;

  @Mock
  private StreamManager streamManager;

  @Mock
  private WriteBack writeBack;

  ServerConfig config = new ServerConfig();

  @InjectMocks
  WorldManager worldManager;

  @BeforeEach
  public void setUp() {
    worldManager.config = config;
    worldManager.clientFactory = new DefaultClientFactory();
    worldManager.init();
    lenient().when(repo.getPermanents(any(Long.class))).thenReturn(new HashSet<VRObject>());
    World world = new World("test");
    world.setId(0L);
    lenient().when(repo.save(any(World.class))).thenReturn(world);
    lenient().when(repo.save(any(VRObject.class))).then(returnsFirstArg());
    // doNothing().when(repo).delete(any(VRObject.class));
  }

  @Test
  public void testGuestAccess() throws Exception {
    config.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();
    Welcome welcome = worldManager.login(session);

    assertNotNull(welcome);
    assertNotNull(welcome.getClient());
    // TODO: assert session methods called
    verify(session, times(0)).sendMessage(any(TextMessage.class));
    // TODO: assert client/scene sanity
  }

  @Test
  public void testGuestDisabled() throws Exception {
    config.setGuestAllowed(false);
    assertThrows(SecurityException.class, () -> worldManager.login(session));
  }

  @Test
  public void testEnter() throws Exception {
    config.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();
    Welcome welcomeDefault = worldManager.login(session);
    World world = new World("one");
    world.setId(1L);
    Welcome welcomeWorld = worldManager.enter(welcomeDefault.getClient(), world);

    assertNotNull(welcomeWorld);
    assertEquals(world, welcomeWorld.getClient().getWorld());
  }

  @Test
  public void testNumberOfSessions() throws Exception {
    config.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();

    ArrayList<Client> clients = new ArrayList<>();
    int max = 5;
    worldManager.sessionTracker.setMaxSessions(max);
    for (int i = 0; i < max; i++) {
      Welcome welcome = worldManager.login(session);
      welcome.getClient().setId(Long.valueOf(i));
      worldManager.startSession(welcome.getClient());
      clients.add(welcome.getClient());
    }

    // wait for 1 sec for session to start
    config.setSessionStartTimeout(1);
    Welcome welcome = worldManager.login(session);
    welcome.getClient().setId(Long.valueOf(max));
    long time = System.currentTimeMillis();
    try {
      worldManager.startSession(welcome.getClient());
      fail();
    } catch (RuntimeException e) {
      // failed after more than 1 sec
      time = System.currentTimeMillis() - time;
      assertTrue(time - 1000 >= 0);
    }

    worldManager.logout(clients.get(0));
    worldManager.startSession(welcome.getClient());

  }

  @Test
  public void testGuestLogout() {
    config.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();

    Welcome welcome = worldManager.login(session);
    List<VRObject> newObjects = new ArrayList<VRObject>();
    // add temporary object:
    newObjects.add(new VRObject(1L));
    VRObject notTemp = new VRObject(2L);
    // add persistent object:
    notTemp.setTemporary(false);
    newObjects.add(notTemp);
    worldManager.add(welcome.getClient(), newObjects);

    // everything added to cache/db
    assertEquals(3, worldManager.cache.size());

    worldManager.logout(welcome.getClient());

    // guest and temporary removed from cache and db
    assertEquals(1, worldManager.cache.size());

  }
}
