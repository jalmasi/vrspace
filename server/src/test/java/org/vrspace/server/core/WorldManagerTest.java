package org.vrspace.server.core;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashSet;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.neo4j.ogm.session.Session;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;

@RunWith(SpringRunner.class)
public class WorldManagerTest {

  @Mock
  private WebSocketSession session;

  @Mock
  private VRObjectRepository repo;

  @Mock
  private Session neo4jSession;

  @Mock
  private StreamManager streamManager;

  ServerConfig config = new ServerConfig();

  @InjectMocks
  WorldManager worldManager;

  @Before
  public void setUp() {
    worldManager.config = config;
    worldManager.init();
    when(repo.getPermanents(any(Long.class))).thenReturn(new HashSet<VRObject>());
    World world = new World("test");
    world.setId(0L);
    when(repo.save(any(World.class))).thenReturn(world);
    when(repo.save(any(Client.class))).then(returnsFirstArg());
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

  @Test(expected = SecurityException.class)
  public void testGuestDisabled() throws Exception {
    config.setGuestAllowed(false);
    worldManager.login(session);
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
      assertTrue(time - 1000 > 0);
    }

    worldManager.logout(clients.get(0));
    worldManager.startSession(welcome.getClient());

  }
}
