package org.vrspace.server.core;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
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

  @InjectMocks
  WorldManager worldManager;

  @Before
  public void setUp() {
    when(repo.getPermanents(any(Long.class))).thenReturn(new HashSet<VRObject>());
    World world = new World("test");
    world.setId(0L);
    when(repo.save(any(World.class))).thenReturn(world);
    when(repo.save(any(Client.class))).then(returnsFirstArg());
  }

  @Test
  public void testGuestAccess() throws Exception {
    worldManager.setGuestAllowed(true);
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
    worldManager.setGuestAllowed(false);
    worldManager.login(session);
  }

  @Test
  public void testEnter() throws Exception {
    worldManager.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();
    Welcome welcomeDefault = worldManager.login(session);
    World world = new World("one");
    world.setId(1L);
    Welcome welcomeWorld = worldManager.enter(welcomeDefault.getClient(), world);

    assertNotNull(welcomeWorld);
    assertEquals(world, welcomeWorld.getClient().getWorld());
  }
}
