package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.config.WorldConfig;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(classes = JacksonConfig.class)
@ExtendWith(MockitoExtension.class)
public class WorldManagerTest {

  @Autowired
  private ObjectMapper objectMapper;

  @Mock
  private ConcurrentWebSocketSessionDecorator session;
  @Mock
  private ConcurrentWebSocketSessionDecorator anotherSession;
  @Mock
  private VRObjectRepository repo;
  @Mock
  private WorldConfig worldConfig;
  @Mock
  private StreamManager streamManager;
  @Mock
  private WriteBack writeBack;

  @InjectMocks
  private WorldManager worldManager;

  private ServerConfig config = new ServerConfig();
  private List<Ownership> owned = new ArrayList<>();
  private long id = 0;
  @Captor
  private ArgumentCaptor<World> capturedWorld;

  @BeforeEach
  public void setUp() {
    worldManager.config = config;
    worldManager.jackson = objectMapper;
    worldManager.clientFactory = new DefaultClientFactory();
    lenient().when(repo.getPermanents(any(Long.class))).thenReturn(new HashSet<VRObject>());
    World world = new World("test");
    world.setId(0L);
    lenient().when(repo.save(any(World.class))).thenReturn(world);
    lenient().when(repo.save(any(VRObject.class))).then(i -> {
      VRObject o = i.getArgument(0, VRObject.class);
      if (o.getId() == null) {
        o.setId(id++);
      }
      return o;
    });
    lenient().when(repo.save(any(Ownership.class))).then(i -> {
      owned.add(i.getArgument(0, Ownership.class));
      return i.getArgument(0, Ownership.class);
    });
    lenient().when(repo.getOwned(anyLong())).thenReturn(owned);
    // doNothing().when(repo).delete(any(VRObject.class));
    worldManager.init();
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
    assertEquals(world.getId(), welcomeWorld.getClient().getWorldId());
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

    // everything added to cache/db, including the world
    assertEquals(4, worldManager.cache.size());

    worldManager.logout(welcome.getClient());

    // guest and owned objects removed from cache and db, world remains
    assertEquals(1, worldManager.cache.size());
  }

  @Test
  public void testNonGuestLogout() {
    mockAuthorizedSession("owner", session);

    config.setGuestAllowed(false);
    worldManager.sceneProperties = new SceneProperties();

    Welcome welcome = worldManager.login(session);
    List<VRObject> newObjects = new ArrayList<VRObject>();
    // add temporary object:
    VRObject temp = new VRObject(1L);
    temp.setTemporary(true);
    newObjects.add(temp);
    VRObject notTemp = new VRObject(2L);
    // add persistent object:
    notTemp.setTemporary(false);
    newObjects.add(notTemp);
    worldManager.add(welcome.getClient(), newObjects);

    // everything added to cache/db, including the world
    assertEquals(4, worldManager.cache.size());

    worldManager.logout(welcome.getClient());

    // temporary removed from cache and db, world, client and persistent remain
    assertEquals(3, worldManager.cache.size());
  }

  @Test
  public void testTemporaryWorld() {
    lenient().doNothing().when(repo).deleteWorld(capturedWorld.capture());

    config.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();
    Welcome welcomeDefault = worldManager.login(session);

    World world = new World("one");
    world.setId(1L);
    world.setOwner(welcomeDefault.getClient());
    world.setTemporaryWorld(true);

    worldManager.saveWorld(world);

    worldManager.enter(welcomeDefault.getClient(), world);
    worldManager.logout(welcomeDefault.getClient());

    assertEquals(world, capturedWorld.getValue());
  }

  private Client mockGuestSession(String clientName, ConcurrentWebSocketSessionDecorator s) {
    Client client = new Client(clientName);
    client.setId(id++);
    client.setGuest(true);
    Map<String, Object> attributes = new HashMap<>();
    attributes.put(ClientFactory.CLIENT_NAME_ATTRIBUTE, clientName);
    lenient().when(s.getAttributes()).thenReturn(attributes);

    lenient().when(repo.getClientByName(ArgumentMatchers.eq(clientName), any())).thenReturn(client);

    return client;
  }

  private Client mockAuthorizedSession(String clientName, ConcurrentWebSocketSessionDecorator s) {
    Client client = mockGuestSession(clientName, s);
    client.setGuest(false);
    lenient().when(s.getPrincipal()).thenReturn(new Principal() {
      @Override
      public String getName() {
        return clientName;
      }
    });
    return client;
  }

  @Test
  public void testPrivateWorld() {
    mockAuthorizedSession("owner", session);

    config.setGuestAllowed(true);
    worldManager.sceneProperties = new SceneProperties();
    Welcome welcomeOwner = worldManager.login(session);
    Client owner = welcomeOwner.getClient();

    World world = new World("one");
    world.setId(1L);
    world.setOwner(owner);
    world.setPublicWorld(false);

    worldManager.saveWorld(world);

    // owner enters:
    worldManager.enter(owner, world);

    mockGuestSession("guest", anotherSession);
    Welcome welcomeGuest = worldManager.login(anotherSession);
    Client guest = welcomeGuest.getClient();

    // guest enters and fails:
    assertThrows(SecurityException.class, () -> worldManager.enter(guest, world));

    // guest enters with wrong token and fails:
    guest.setToken(world.tokenName(), "BADTOKEN");
    assertThrows(SecurityException.class, () -> worldManager.enter(guest, world));

    // guest enters with good token and succeeds:
    world.setToken("GOODTOKEN");
    guest.setToken(world.tokenName(), "GOODTOKEN");
    worldManager.enter(guest, world);

    // owner exits, token is removed
    worldManager.logout(owner);
    assertNull(world.getToken());
  }

}
