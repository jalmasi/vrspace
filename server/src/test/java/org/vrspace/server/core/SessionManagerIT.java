package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.ClientResponse;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.User;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@ExtendWith(MockitoExtension.class)
//FIXME:
@DirtiesContext
public class SessionManagerIT {

  @Mock
  private WebSocketSession session;

  @Autowired
  private SessionManager sessionManager;

  @Autowired
  private WorldManager worldManager;

  @Autowired
  private VRObjectRepository repo;
  private static VRObjectRepository staticRepo;

  @Autowired
  private ServerConfig config;

  @Captor
  private ArgumentCaptor<WebSocketMessage<?>> message;

  @Autowired
  @Qualifier("objectMapper")
  private ObjectMapper mapper;

  private User testUser;
  private User dbUser;

  @BeforeEach
  public void setUp() throws Exception {
    staticRepo = this.repo;
    System.err.println("Database objects before: " + repo.count());
    mockup(this.session, "testSession");
    createTestUser();
    System.err.println("Database objects on start: " + repo.count());
  }

  private WebSocketSession mockup(WebSocketSession session, String sessionId) throws Exception {
    when(session.getId()).thenReturn(sessionId);
    lenient().when(session.isOpen()).thenReturn(true);
    doNothing().when(session).sendMessage(message.capture());
    return session;
  }

  @AfterEach
  public void tearDown() throws Exception {
    // FIXME this may not delete the user, sometimes causing other test(s) to fail
    // GroupsIT.testPrivateWorkflow
    // on slow machines?
    repo.delete(dbUser);
    System.err.println("Database objects after: " + repo.count());
    repo.findAll().forEach(e -> {
      if (e instanceof World && ((World) e).isDefaultWorld()) {
        System.err.println("Not deleting " + e);
      } else {
        System.err.println("Deleting " + e);
        repo.delete(e);
      }
    });
    System.err.println("Database objects after: " + repo.count());
  }

  @AfterAll
  public static void cleanUp() throws Exception {
    System.err.println("Database at end: " + staticRepo.count());
    staticRepo.findAll().forEach(e -> {
      System.err.println("Deleting " + e);
      staticRepo.delete(e);
    });
  }

  @Test
  public void testAnonymousLogin() throws Exception {
    config.setGuestAllowed(true);
    when(session.getPrincipal()).thenReturn(null);

    login();
  }

  @Test
  public void testNamedLogin() throws Exception {
    config.setGuestAllowed(false);
    login();
  }

  private void createTestUser() throws Exception {
    when(session.getPrincipal()).thenReturn(new Principal() {
      @Override
      public String getName() {
        return "tester";
      }
    });
    Map<String, Object> attributes = new HashMap<>();
    attributes.put(ClientFactory.CLIENT_NAME_ATTRIBUTE, "tester");
    when(session.getAttributes()).thenReturn(attributes);

    testUser = new User();
    testUser.setName("tester");
    testUser.setPosition(new Point(1, 2, 3));
    testUser = repo.save(testUser);
    dbUser = testUser;
  }

  private String login(WebSocketSession session) throws Exception {
    sessionManager.afterConnectionEstablished(session);
    // verify Welcome message
    verify(session, times(1)).sendMessage(any(TextMessage.class));
    String welcomeMsg = getMessage();
    Welcome welcome = mapper.readValue(welcomeMsg, Welcome.class);
    System.err.println(welcome);
    assertNotNull(welcome.getClient());
    assertNotNull(welcome.getClient().getId());
    testUser = (User) worldManager.get(new ID(testUser));
    return welcome.getClient().getId();
  }

  private String login() throws Exception {
    return login(this.session);
  }

  private void startSession(WebSocketSession session) throws Exception {
    sendMessage(session, "{\"command\":{\"Session\":{}}}'");
  }

  private void startSession() throws Exception {
    startSession(this.session);
  }

  @Test
  public void testAnonymousLoginFail() throws Exception {
    config.setGuestAllowed(false);
    when(session.getPrincipal()).thenReturn(null);
    sessionManager.afterConnectionEstablished(session);

    String errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Unauthorized"));
    verify(session, times(1)).close();
  }

  @Test
  public void testInvalidLoginFail() throws Exception {
    config.setGuestAllowed(false);
    Map<String, Object> attributes = new HashMap<>();
    attributes.put(ClientFactory.CLIENT_NAME_ATTRIBUTE, "unknown");
    when(session.getAttributes()).thenReturn(attributes);
    sessionManager.afterConnectionEstablished(session);

    String errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Unauthorized"));
    verify(session, times(1)).close();
  }

  @Test
  public void testWrongClient() throws Exception {
    String clientId = login();
    String string = "{\"object\":{\"Client\":\"" + (clientId + 1)
        + "\"},\"changes\":{\"position\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}";
    sendMessage(string);
    String errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Client has no scene"));

    startSession();

    sendMessage(string);
    errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Unknown object"));
  }

  private void sendMessage(WebSocketSession session, String msg) throws Exception {
    System.err.println(msg);
    TextMessage message = new TextMessage(msg);
    sessionManager.handleMessage(session, message);
  }

  private void sendMessage(String msg) throws Exception {
    sendMessage(this.session, msg);
  }

  private String getMessage() {
    String msg = ((TextMessage) message.getValue()).getPayload();
    System.err.println(msg);
    return msg;
  }

  @Test
  public void testChangeOwnProperty() throws Exception {
    String clientId = login();
    assertEquals(1, testUser.getPosition().getX(), 0.01);
    assertEquals(2, testUser.getPosition().getY(), 0.01);
    assertEquals(3, testUser.getPosition().getZ(), 0.01);

    String string = "{\"object\":{\"User\":\"" + clientId + "\"},\"changes\":{\"position\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}";
    System.err.println(string);
    sendMessage(string);

    assertNotNull(testUser.getPosition());
    assertEquals(3, testUser.getPosition().getX(), 0.01);
    assertEquals(2, testUser.getPosition().getY(), 0.01);
    assertEquals(1, testUser.getPosition().getZ(), 0.01);
  }

  @Disabled("apparently identity is the only private field that is persisted, and rightfully marked with JsonIgnore")
  @Test
  public void testChangePrivateProperty() throws Exception {
    String clientId = login();

    String string = "{\"object\":{\"User\":" + clientId + "},\"changes\":{\"identity\":\"joe@facebook\"}}";
    System.err.println(string);
    sendMessage(string);

    System.err.println(testUser.getIdentity());

    assertNotNull(testUser.getIdentity());
  }

  @Test
  public void testAddRemove() throws Exception {
    login();
    startSession();

    // String add =
    // "{\"command\":{\"Add\":{\"objects\":[{\"VRObject\":{\"position\":{\"x\":3,\"y\":2,\"z\":1}}},
    // {\"VRObject\":{}}]}}}";
    String add = "{\"command\":{\"Add\":{\"objects\":[{\"VRObject\":{\"position\":{\"x\":3,\"y\":2,\"z\":1}}}, {\"VRObject\":{\"position\":{\"x\":3,\"y\":2,\"z\":1}}}]}}}";
    sendMessage(add);

    // response to session, response to add + scene update, called from
    // Client.sendMessage()
    verify(session, times(4)).sendMessage(any(TextMessage.class));

    // verify response to add command
    List<WebSocketMessage<?>> allValues = message.getAllValues();
    // make sure to ignore any PingMessage
    List<TextMessage> values = allValues.stream().filter(m -> TextMessage.class.isInstance(m)).map(m -> (TextMessage) m)
        .collect(Collectors.toList());
    String addResponse = ((TextMessage) values.get(3)).getPayload();
    ClientResponse rIds = mapper.readValue(addResponse, ClientResponse.class);
    @SuppressWarnings("unchecked")
    List<Map<String, String>> ids = (List<Map<String, String>>) rIds.getResponse();
    assertEquals(2, ids.size());

    // verify received add command as result of scene update
    String sceneMessage = ((TextMessage) values.get(2)).getPayload();
    Add addCommand = mapper.readValue(sceneMessage, Add.class);
    assertEquals(2, addCommand.getObjects().size());

    // verify objects exist in the database
    Optional<VRObject> obj1 = repo.findById(VRObject.class, ids.get(0).values().iterator().next());
    Optional<VRObject> obj2 = repo.findById(VRObject.class, ids.get(1).values().iterator().next());
    assertTrue(obj1.isPresent());
    assertTrue(obj2.isPresent());
    // verify their positions are different
    // (ownership data model may mess that up)
    assertFalse(obj1.get().getPosition().getId().equals(obj2.get().getPosition().getId()));

    // verify ownership
    assertNotNull(repo.getOwnedObjects(testUser.getId()));
    assertEquals(2, repo.getOwnedObjects(testUser.getId()).size());

    // verify scene members match response to add command
    int ok = 0;
    for (Map<String, String> id : ids) {
      for (VRObject obj : addCommand.getObjects()) {
        if (id.get("VRObject").equals(obj.getId())) {
          assertNotNull(obj.getPosition(), "Object must have position" + obj);
          ok++;
          break;
        }
      }
    }
    assertEquals(2, ok, "Returned VRObject IDs don't match the scene");

    // verify that scene does not update
    testUser.getScene().update();

    verify(session, times(4)).sendMessage(any(TextMessage.class));
    assertEquals(2, testUser.getScene().size());

    // verify remove command
    String remove = "{\"command\":{\"Remove\":{\"objects\":[{\"VRObject\":\"" + ids.iterator().next().values().iterator().next()
        + "\"}]}}}";
    sendMessage(remove);

    // verify response received
    verify(session, times(5)).sendMessage(any(TextMessage.class));

    // verify object removed from the database
    assertFalse(repo.findById(VRObject.class, ids.get(0).values().iterator().next()).isPresent());
    assertTrue(repo.findById(VRObject.class, ids.get(1).values().iterator().next()).isPresent());

    // verify ownership
    assertEquals(1, repo.getOwnedObjects(testUser.getId()).size());

    // verify scene members
    testUser.getScene().update();

    verify(session, times(5)).sendMessage(any(TextMessage.class));
    assertEquals(1, testUser.getScene().size());
    sceneMessage = getMessage();

    // verify remove command
    Remove removeCmd = mapper.readValue(sceneMessage, Remove.class);
    assertEquals(1, removeCmd.getObjects().size());
    assertEquals(ids.get(0).values().iterator().next(), removeCmd.next().getId());
  }

  @Test
  public void testMulticast() throws Exception {
    config.setGuestAllowed(true);

    WebSocketSession session1 = mockup(mock(WebSocketSession.class), "session1");
    WebSocketSession session2 = mockup(mock(WebSocketSession.class), "session2");

    String clientId = login();
    String cid1 = login(session1);
    String cid2 = login(session2);
    Client client = sessionManager.getClient(clientId);
    Client user1 = sessionManager.getClient(cid1);
    Client user2 = sessionManager.getClient(cid2);
    assertNotNull(client);
    assertNotNull(user1);
    assertNotNull(user2);
    assertNotNull(client.getWorldId());
    assertEquals(client.getWorldId(), user1.getWorldId());
    assertEquals(client.getWorldId(), user2.getWorldId());

    startSession();
    startSession(session1);
    startSession(session2);

    // assert they all see each other
    client.getScene().update();
    assertEquals(2, client.getScene().size());
    assertNotNull(client.getScene().get(user1.getObjectId()));
    assertNotNull(client.getScene().get(user2.getObjectId()));
    // response to session, response to add, scene update
    verify(session, times(3)).sendMessage(any(TextMessage.class));

    user1.getScene().update();
    assertEquals(2, user1.getScene().size());
    assertNotNull(user1.getScene().get(client.getObjectId()));
    assertNotNull(user1.getScene().get(user2.getObjectId()));
    verify(session1, times(3)).sendMessage(any(TextMessage.class));

    user2.getScene().update();
    assertEquals(2, user2.getScene().size());
    assertNotNull(user2.getScene().get(client.getObjectId()));
    assertNotNull(user2.getScene().get(user1.getObjectId()));
    verify(session2, times(3)).sendMessage(any(TextMessage.class));

    assertEquals(2, user1.getListeners().size());
    assertEquals(2, user2.getListeners().size());
    assertEquals(2, client.getListeners().size());

    // move and verify movement received by listeners but not by self
    String string = "{\"object\":{\"User\":\"" + clientId + "\"},\"changes\":{\"position\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}";
    sendMessage(string);

    verify(session, times(3)).sendMessage(any(TextMessage.class));
    verify(session1, times(4)).sendMessage(any(TextMessage.class));
    verify(session2, times(4)).sendMessage(any(TextMessage.class));

    // verify that client's properties have changed in other scenes
    Point expected = new Point(3, 2, 1);
    assertTrue(expected.isEqual(client.getPosition()));
    assertTrue(expected.isEqual(user1.getScene().get(client.getObjectId()).getPosition()));
    assertTrue(expected.isEqual(user2.getScene().get(client.getObjectId()).getPosition()));

    // set properties of a client
    String msg = "{\"object\":{\"User\":\"" + clientId
        + "\"},\"changes\":{\"properties\":{\"string\":\"string\",\"number\":123.45}}}";
    sendMessage(msg);
    verify(session, times(3)).sendMessage(any(TextMessage.class));
    verify(session1, times(5)).sendMessage(any(TextMessage.class));
    verify(session2, times(5)).sendMessage(any(TextMessage.class));

    assertNotNull(client.getProperties());
    assertEquals("string", client.getProperties().get("string"));
    assertEquals(123.45, client.getProperties().get("number"));

    // custom event, e.g. chat
    String text = "{\"object\":{\"User\":\"" + clientId + "\"},\"changes\":{\"wrote\":\"hi\"}}";
    sendMessage(text);
    verify(session, times(3)).sendMessage(any(TextMessage.class));
    verify(session1, times(6)).sendMessage(any(TextMessage.class));
    verify(session2, times(6)).sendMessage(any(TextMessage.class));
  }

  @Test
  @Transactional
  public void testEnterUnknown() throws Exception {
    config.setGuestAllowed(true);
    config.setCreateWorlds(false);
    when(session.getPrincipal()).thenReturn(null);

    login();

    sendMessage("{\"command\":{\"Enter\":{}}}");

    verify(session, times(2)).sendMessage(any(TextMessage.class));
    assertTrue(getMessage().contains("Unknown world"));

    // must be unique name - some other test may have created it
    sendMessage("{\"command\":{\"Enter\":{\"world\":\"nonExistingWorld\"}}}");

    verify(session, times(3)).sendMessage(any(TextMessage.class));
    assertTrue(getMessage().contains("Unknown world"));
  }

  @Test
  @Transactional
  public void testEnterValid() throws Exception {
    config.setGuestAllowed(true);
    when(session.getPrincipal()).thenReturn(null);

    World world = repo.save(new World("test"));

    login();

    sendMessage("{\"command\":{\"Enter\":{\"world\":\"test\"}}}");

    verify(session, times(2)).sendMessage(any(TextMessage.class));

    String welcomeMsg = getMessage();
    Welcome welcome = mapper.readValue(welcomeMsg, Welcome.class);
    System.err.println(welcome);
    assertNotNull(welcome.getClient());
    assertNotNull(welcome.getClient().getId());

    Client client = repo.get(Client.class, welcome.getClient().getId());
    assertEquals(world.getId(), client.getWorldId());
  }

  @Test
  @Transactional
  public void testCleanupOnExit() throws Exception {
    login();
    startSession();

    String add = "{\"command\":{\"Add\":{\"objects\":[{\"VRObject\":{\"temporary\":true,\"position\":{\"x\":3,\"y\":2,\"z\":1}}}, {\"VRObject\":{\"position\":{\"x\":3,\"y\":2,\"z\":1}}}]}}}";
    sendMessage(add);

    verify(session, times(4)).sendMessage(any(TextMessage.class));

    long beforeClose = repo.count();
    sessionManager.afterConnectionClosed(session, CloseStatus.NORMAL);
    long afterClose = repo.count();
    // removed ownership, object and position
    assertEquals(beforeClose - 3, afterClose);
  }
}
