package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
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
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
public class SessionManagerTest {

  @Mock
  private WebSocketSession session;

  @Autowired
  private SessionManager sessionManager;

  @Autowired
  private VRObjectRepository repo;

  @Autowired
  private ServerConfig config;

  @Captor
  private ArgumentCaptor<WebSocketMessage<?>> message;

  @Autowired
  private ObjectMapper mapper;

  private Client testUser;

  @BeforeEach
  public void setUp() throws Exception {
    mockup(this.session, "testSession");
    createTestUser();
  }

  private WebSocketSession mockup(WebSocketSession session, String sessionId) throws Exception {
    when(session.getId()).thenReturn(sessionId);
    when(session.isOpen()).thenReturn(true);
    doNothing().when(session).sendMessage(message.capture());
    return session;
  }

  @AfterEach
  public void tearDown() throws Exception {
    repo.delete(testUser);
    // System.err.println("Database objects after: " + repo.count());
  }

  @Test
  @Transactional
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
    testUser = new Client();
    testUser.setName("tester");
    testUser.setPosition(new Point(1, 2, 3));
    testUser = repo.save(testUser);
  }

  private Long login(WebSocketSession session) throws Exception {
    sessionManager.afterConnectionEstablished(session);
    // verify Welcome message
    verify(session, times(1)).sendMessage(any(TextMessage.class));
    String welcomeMsg = getMessage();
    Welcome welcome = mapper.readValue(welcomeMsg, Welcome.class);
    System.err.println(welcome);
    assertNotNull(welcome.getClient());
    assertNotNull(welcome.getClient().getId());
    return welcome.getClient().getId();
  }

  private Long login() throws Exception {
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
    when(session.getPrincipal()).thenReturn(new Principal() {
      @Override
      public String getName() {
        return "unknown";
      }
    });
    sessionManager.afterConnectionEstablished(session);

    String errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Unauthorized"));
    verify(session, times(1)).close();
  }

  @Test
  public void testWrongClient() throws Exception {
    Long clientId = login();
    String string = "{\"object\":{\"Client\":" + (clientId + 1)
        + "},\"changes\":{\"position\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}";
    sendMessage(string);
    String errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Client has no scene"));

    startSession();

    sendMessage(string);
    errorMsg = getMessage();
    assertTrue(errorMsg.contains("ERROR"));
    assertTrue(errorMsg.contains("Object not found in the scene"));
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
  @Transactional
  public void testChangeOwnProperty() throws Exception {
    Long clientId = login();
    assertEquals(1, testUser.getPosition().getX(), 0.01);
    assertEquals(2, testUser.getPosition().getY(), 0.01);
    assertEquals(3, testUser.getPosition().getZ(), 0.01);

    String string = "{\"object\":{\"Client\":" + clientId
        + "},\"changes\":{\"position\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}";
    System.err.println(string);
    sendMessage(string);

    assertNotNull(testUser.getPosition());
    assertEquals(3, testUser.getPosition().getX(), 0.01);
    assertEquals(2, testUser.getPosition().getY(), 0.01);
    assertEquals(1, testUser.getPosition().getZ(), 0.01);
  }

  @Test
  @Transactional
  public void testAddRemove() throws Exception {
    login();
    startSession();

    String add = "{\"command\":{\"Add\":{\"objects\":[{\"VRObject\":{\"position\":{\"x\":3,\"y\":2,\"z\":1}}}, {\"VRObject\":{}}]}}}";
    sendMessage(add);

    // response to add + scene update, called from Client.sendMessage()
    verify(session, times(3)).sendMessage(any(TextMessage.class));

    // verify response to add command
    List<WebSocketMessage<?>> values = message.getAllValues();
    String addResponse = ((TextMessage) values.get(2)).getPayload();
    ClientResponse rIds = mapper.readValue(addResponse, ClientResponse.class);
    @SuppressWarnings("unchecked")
    List<Map<String, Long>> ids = (List<Map<String, Long>>) rIds.getResponse();
    assertEquals(2, ids.size());

    // verify received add command as result of scene update
    String sceneMessage = ((TextMessage) values.get(1)).getPayload();
    Add addCommand = mapper.readValue(sceneMessage, Add.class);
    assertEquals(2, addCommand.getObjects().size());

    // verify objects exist in the database
    assertTrue(repo.findById(ids.get(0).values().iterator().next()).isPresent());
    assertTrue(repo.findById(ids.get(1).values().iterator().next()).isPresent());

    // verify ownership
    assertEquals(2, testUser.getOwned().size());

    // verify scene members match response to add command
    int ok = 0;
    for (Map<String, Long> id : ids) {
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

    verify(session, times(3)).sendMessage(any(TextMessage.class));
    assertEquals(2, testUser.getScene().size());

    // verify remove command
    String remove = "{\"command\":{\"Remove\":{\"objects\":[{\"VRObject\":"
        + ids.iterator().next().values().iterator().next() + "}]}}}";
    sendMessage(remove);

    // verify response received
    verify(session, times(4)).sendMessage(any(TextMessage.class));

    // verify object removed from the database
    assertFalse(repo.findById(ids.get(0).values().iterator().next()).isPresent());
    assertTrue(repo.findById(ids.get(1).values().iterator().next()).isPresent());

    // verify ownership
    assertEquals(1, testUser.getOwned().size());

    // verify scene members
    testUser.getScene().update();

    verify(session, times(4)).sendMessage(any(TextMessage.class));
    assertEquals(1, testUser.getScene().size());
    sceneMessage = getMessage();

    // verify remove command
    Remove removeCmd = mapper.readValue(sceneMessage, Remove.class);
    assertEquals(1, removeCmd.getObjects().size());
    assertEquals(ids.get(0).values().iterator().next(), removeCmd.next().getId());
  }

  @Test
  @Transactional
  public void testMulticast() throws Exception {
    config.setGuestAllowed(true);

    WebSocketSession session1 = mockup(mock(WebSocketSession.class), "session1");
    WebSocketSession session2 = mockup(mock(WebSocketSession.class), "session2");

    Long clientId = login();
    Long cid1 = login(session1);
    Long cid2 = login(session2);
    Client client = sessionManager.getClient(clientId);
    Client user1 = sessionManager.getClient(cid1);
    Client user2 = sessionManager.getClient(cid2);
    assertNotNull(client);
    assertNotNull(user1);
    assertNotNull(user2);
    assertNotNull(client.getWorld());
    assertEquals(client.getWorld(), user1.getWorld());
    assertEquals(client.getWorld(), user2.getWorld());

    startSession();
    startSession(session1);
    startSession(session2);

    // assert they all see each other
    client.getScene().update();
    assertEquals(2, client.getScene().size());
    assertNotNull(client.getScene().get(user1.getObjectId()));
    assertNotNull(client.getScene().get(user2.getObjectId()));
    verify(session, times(2)).sendMessage(any(WebSocketMessage.class));

    user1.getScene().update();
    assertEquals(2, user1.getScene().size());
    assertNotNull(user1.getScene().get(client.getObjectId()));
    assertNotNull(user1.getScene().get(user2.getObjectId()));
    verify(session1, times(2)).sendMessage(any(WebSocketMessage.class));

    user2.getScene().update();
    assertEquals(2, user2.getScene().size());
    assertNotNull(user2.getScene().get(client.getObjectId()));
    assertNotNull(user2.getScene().get(user1.getObjectId()));
    verify(session2, times(2)).sendMessage(any(WebSocketMessage.class));

    assertEquals(2, user1.getListeners().size());
    assertEquals(2, user2.getListeners().size());
    assertEquals(2, client.getListeners().size());

    // move and verify movement received by listeners but not by self
    String string = "{\"object\":{\"Client\":" + clientId
        + "},\"changes\":{\"position\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}";
    sendMessage(string);

    verify(session, times(2)).sendMessage(any(WebSocketMessage.class));
    verify(session1, times(3)).sendMessage(any(WebSocketMessage.class));
    verify(session2, times(3)).sendMessage(any(WebSocketMessage.class));

    // verify that client's properties have changed in other scenes
    Point expected = new Point(3, 2, 1);
    assertEquals(expected, client.getPosition());
    assertEquals(expected, user1.getScene().get(client.getObjectId()).getPosition());
    assertEquals(expected, user2.getScene().get(client.getObjectId()).getPosition());

    // set properties of a client
    String msg = "{\"object\":{\"Client\":" + clientId
        + "},\"changes\":{\"properties\":{\"string\":\"string\",\"number\":123.45}}}";
    sendMessage(msg);
    verify(session, times(2)).sendMessage(any(WebSocketMessage.class));
    verify(session1, times(4)).sendMessage(any(WebSocketMessage.class));
    verify(session2, times(4)).sendMessage(any(WebSocketMessage.class));

    assertNotNull(client.getProperties());
    assertEquals("string", client.getProperties().get("string"));
    assertEquals(123.45, client.getProperties().get("number"));

    // custom event, e.g. chat
    String text = "{\"object\":{\"Client\":" + clientId + "},\"changes\":{\"wrote\":\"hi\"}}";
    sendMessage(text);
    verify(session, times(2)).sendMessage(any(WebSocketMessage.class));
    verify(session1, times(5)).sendMessage(any(WebSocketMessage.class));
    verify(session2, times(5)).sendMessage(any(WebSocketMessage.class));
  }

  @Test
  @Transactional
  public void testEnterUnknown() throws Exception {
    config.setGuestAllowed(true);
    config.setCreateWorlds(false);
    when(session.getPrincipal()).thenReturn(null);

    login();

    sendMessage("{\"command\":{\"Enter\":{}}}");

    verify(session, times(2)).sendMessage(any(WebSocketMessage.class));
    assertTrue(getMessage().contains("Unknown world"));

    sendMessage("{\"command\":{\"Enter\":{\"world\":\"test\"}}}");

    verify(session, times(3)).sendMessage(any(WebSocketMessage.class));
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

    verify(session, times(2)).sendMessage(any(WebSocketMessage.class));

    String welcomeMsg = getMessage();
    Welcome welcome = mapper.readValue(welcomeMsg, Welcome.class);
    System.err.println(welcome);
    assertNotNull(welcome.getClient());
    assertNotNull(welcome.getClient().getId());

    Client client = repo.get(Client.class, welcome.getClient().getId());
    assertEquals(world, client.getWorld());
  }

}
