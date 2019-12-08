package org.vrspace.server;

import static org.junit.Assert.assertNotNull;
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
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

@RunWith(SpringRunner.class)
public class WorldTest {

  @Mock
  WebSocketSession session;

  @Mock
  VRObjectRepository repo;

  @InjectMocks
  World world;

  @Before
  public void setUp() {
    when(repo.getPermanents()).thenReturn(new HashSet<VRObject>());
    when(repo.save(any(Client.class))).thenReturn(new Client());
  }

  @Test
  public void testGuestAccess() throws Exception {
    world.setGuestAllowed(true);
    world.sceneProperties = new SceneProperties();
    Welcome welcome = world.login(session);

    assertNotNull(welcome);
    assertNotNull(welcome.getClient());
    // TODO: assert session methods called
    verify(session, times(0)).sendMessage(any(TextMessage.class));
    // TODO: assert client/scene sanity
  }

  @Test(expected = SecurityException.class)
  public void testGuestDisabled() throws Exception {
    world.setGuestAllowed(false);
    world.login(session);
  }
}
