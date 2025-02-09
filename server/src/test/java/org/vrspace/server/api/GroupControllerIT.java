package org.vrspace.server.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.SessionManager;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.User;
import org.vrspace.server.obj.UserGroup;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

//@WebMvcTest(controllers = GroupController.class, excludeAutoConfiguration = { SecurityAutoConfiguration.class })
@SpringBootTest
@ExtendWith(MockitoExtension.class)

public class GroupControllerIT {
  private static String ENDPOINT = GroupController.PATH;
  private MockMvc mockMvc;

  @Autowired
  @Qualifier("objectMapper")
  private ObjectMapper objectMapper;
  @Autowired
  private WebApplicationContext webApplicationContext;
  @Autowired
  private VRObjectRepository repo;

  @Mock
  private WebSocketSession socket1;
  @Mock
  private WebSocketSession socket2;
  @Autowired
  private SessionManager sessionManager;

  private MockHttpSession session1 = new MockHttpSession();
  private MockHttpSession session2 = new MockHttpSession();
  private Client client1;
  private Client client2;

  @BeforeEach
  public void setup() throws Exception {
    this.mockMvc = MockMvcBuilders.webAppContextSetup(this.webApplicationContext).build();

    client1 = createUser(socket1, session1, "testUser1");
    client2 = createUser(socket2, session2, "testUser2");
  }

  @AfterEach
  public void cleanup() {
    repo.delete(client1);
    repo.delete(client2);
  }

  @Test
  public void testCreateListJoinShowLeaveDelete() throws Exception {
    // client1 creates a public group
    MvcResult emptyResult1 = mockMvc.perform(get(ENDPOINT).session(session1)).andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(emptyResult1, UserGroup.class).size());

    MvcResult createResult = mockMvc.perform(post(ENDPOINT).session(session1).param("name", "testGroup"))
        .andExpect(status().isCreated()).andReturn();
    UserGroup group = getObject(createResult, UserGroup.class);
    assertNotNull(group);

    MvcResult listResult = mockMvc.perform(get(ENDPOINT).session(session1)).andExpect(status().isOk()).andReturn();
    List<UserGroup> groupList = getList(listResult, UserGroup.class);
    assertEquals(1, groupList.size());

    MvcResult showResult1 = mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    List<Client> clientList1 = getList(showResult1, Client.class);
    assertEquals(1, clientList1.size());

    // client 2 joins
    MvcResult emptyResult2 = mockMvc.perform(get(ENDPOINT).session(session2)).andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(emptyResult2, UserGroup.class).size());

    mockMvc.perform(post(ENDPOINT + "/{groupId}/join", group.getId()).session(session2)).andExpect(status().isOk())
        .andReturn();

    MvcResult joined2 = mockMvc.perform(get(ENDPOINT).session(session2)).andExpect(status().isOk()).andReturn();
    assertEquals(1, getList(joined2, UserGroup.class).size());

    MvcResult showResult2 = mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session2))
        .andExpect(status().isOk()).andReturn();
    List<Client> clientList2 = getList(showResult2, Client.class);
    assertEquals(2, clientList2.size());

    // client 1 can't leave, client 2 can't delete
    mockMvc.perform(post(ENDPOINT + "/{groupId}/leave", group.getId()).session(session1))
        .andExpect(status().isUnprocessableEntity()).andReturn();
    mockMvc.perform(delete(ENDPOINT + "/{groupId}", group.getId()).session(session2)).andExpect(status().isForbidden())
        .andReturn();

    // client 2 leaves
    mockMvc.perform(post(ENDPOINT + "/{groupId}/leave", group.getId()).session(session2)).andExpect(status().isOk())
        .andReturn();

    MvcResult left = mockMvc.perform(get(ENDPOINT).session(session2)).andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(left, UserGroup.class).size());

    mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session2)).andExpect(status().isNotFound())
        .andReturn();

    MvcResult showLeft = mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    List<Client> clientList3 = getList(showLeft, Client.class);
    assertEquals(1, clientList3.size());

    // delete
    mockMvc.perform(delete(ENDPOINT + "/{groupId}", group.getId()).session(session1)).andExpect(status().isOk())
        .andReturn();

    MvcResult deleted = mockMvc.perform(get(ENDPOINT).session(session1)).andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(deleted, UserGroup.class).size());

    mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session1)).andExpect(status().isNotFound())
        .andReturn();

  }

  @Test
  public void testPrivateWorkflow() throws Exception {
    // client1 creates a private group
    MvcResult emptyResult1 = mockMvc.perform(get(ENDPOINT).session(session1)).andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(emptyResult1, UserGroup.class).size());

    MvcResult createResult = mockMvc
        .perform(post(ENDPOINT).session(session1).param("name", "testGroup").param("isPrivate", "true"))
        .andExpect(status().isCreated()).andReturn();
    UserGroup group = getObject(createResult, UserGroup.class);
    assertNotNull(group);

    MvcResult listResult = mockMvc.perform(get(ENDPOINT).session(session1)).andExpect(status().isOk()).andReturn();
    List<UserGroup> groupList = getList(listResult, UserGroup.class);
    assertEquals(1, groupList.size());

    MvcResult showResult1 = mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    List<Client> clientList1 = getList(showResult1, Client.class);
    assertEquals(1, clientList1.size());

    // invites client2, sees the invitation, accepts
    mockMvc.perform(post(ENDPOINT + "/{groupId}/invite", group.getId()).session(session1).param("clientId",
        client2.getId().toString())).andExpect(status().isOk()).andReturn();

    MvcResult invitesResult = mockMvc.perform(get(ENDPOINT + "/invitations").session(session2))
        .andExpect(status().isOk()).andReturn();
    List<UserGroup> invites = objectMapper.readValue(getResult(invitesResult), new TypeReference<List<UserGroup>>() {
    });
    assertEquals(1, invites.size());
    assertEquals(group.getId(), invites.get(0).getId());
    assertTrue(invites.get(0).isPrivate());

    mockMvc.perform(post(ENDPOINT + "/{groupId}/accept", group.getId()).session(session2).param("clientId",
        client2.getId().toString())).andExpect(status().isOk()).andReturn();

    invitesResult = mockMvc.perform(get(ENDPOINT + "/invitations").session(session2)).andExpect(status().isOk())
        .andReturn();
    assertEquals(0, getList(invitesResult, GroupMember.class).size());

    MvcResult showResult2 = mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    List<Client> clientList2 = getList(showResult2, Client.class);
    assertEquals(2, clientList2.size());

    // client2 writes something, gets kicked, can't write any more
    mockMvc.perform(post(ENDPOINT + "/{groupId}/write", group.getId()).content("hello group kick me").session(session2))
        .andExpect(status().isOk()).andReturn();

    mockMvc.perform(post(ENDPOINT + "/{groupId}/kick", group.getId()).session(session1).param("clientId",
        client2.getId().toString())).andExpect(status().isOk()).andReturn();

    MvcResult showResult3 = mockMvc.perform(get(ENDPOINT + "/{groupId}/show", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    List<Client> clientList3 = getList(showResult3, Client.class);
    assertEquals(1, clientList3.size());

    mockMvc.perform(post(ENDPOINT + "/{groupId}/write", group.getId()).content("writing some more").session(session2))
        .andExpect(status().isNotFound()).andReturn();

    // client2 asks to join, client1 sees the request, and rejects it
    mockMvc.perform(post(ENDPOINT + "/{groupId}/ask", group.getId()).session(session2)).andExpect(status().isOk())
        .andReturn();

    MvcResult requestsResult = mockMvc.perform(get(ENDPOINT + "/{groupId}/requests", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    List<GroupMember> pendingRequests = objectMapper.readValue(getResult(requestsResult),
        new TypeReference<List<GroupMember>>() {
        });
    assertEquals(1, pendingRequests.size());
    assertEquals(group.getId(), pendingRequests.get(0).getGroup().getId());
    assertEquals(client2.getId(), pendingRequests.get(0).getClient().getId());

    mockMvc.perform(post(ENDPOINT + "/{groupId}/kick", group.getId()).session(session1).param("clientId",
        client2.getId().toString())).andExpect(status().isOk()).andReturn();

    requestsResult = mockMvc.perform(get(ENDPOINT + "/{groupId}/requests", group.getId()).session(session1))
        .andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(requestsResult, GroupMember.class).size());

  }

  private String getResult(MvcResult result) throws Exception {
    String string = result.getResponse().getContentAsString();
    System.err.println(string);
    return string;
  }

  // does not return actual T due to type erasure, but a LinkedHashMap
  // useful only for count
  private <T> List<T> getList(MvcResult result, Class<T> cls) throws Exception {
    String string = result.getResponse().getContentAsString();
    System.err.println(string);
    return objectMapper.readValue(string, new TypeReference<List<T>>() {
    });
  }

  private <T> T getObject(MvcResult result, Class<T> cls) throws Exception {
    String string = result.getResponse().getContentAsString();
    System.err.println(string);
    return objectMapper.readValue(string, cls);
  }

  private User createUser(WebSocketSession socket, MockHttpSession session, String name) throws Exception {
    /*
    when(socket.getPrincipal()).thenReturn(new Principal() {
      @Override
      public String getName() {
        return name;
      }
    });
    Map<String, Object> attributes = new HashMap<>();
    attributes.put(ClientFactory.CLIENT_NAME_ATTRIBUTE, name);
    when(socket.getAttributes()).thenReturn(attributes);
    */

    User testUser = new User();
    testUser.setName(name);
    testUser.setPosition(new Point(1, 2, 3));
    testUser = repo.save(testUser);
    // attributes.put(ClientFactory.CLIENT_ID_ATTRIBUTE, testUser.getId());

    session.setAttribute(ClientFactory.CLIENT_NAME_ATTRIBUTE, name);
    session.setAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE, testUser.getId());

    return testUser;
  }

}
