package org.vrspace.server.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
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

    MvcResult showResult1 = mockMvc.perform(get(ENDPOINT + "/show").session(session1)).andExpect(status().isOk())
        .andReturn();
    List<Client> clientList1 = getList(showResult1, Client.class);
    assertEquals(1, clientList1.size());

    // client 2 joins
    MvcResult emptyResult2 = mockMvc.perform(get(ENDPOINT).session(session2)).andExpect(status().isOk()).andReturn();
    assertEquals(0, getList(emptyResult2, UserGroup.class).size());

    mockMvc.perform(post(ENDPOINT + "/{groupId}/join", group.getId()).session(session2)).andExpect(status().isOk())
        .andReturn();

    MvcResult joined2 = mockMvc.perform(get(ENDPOINT).session(session2)).andExpect(status().isOk()).andReturn();
    assertEquals(1, getList(joined2, UserGroup.class).size());

    MvcResult showResult2 = mockMvc.perform(get(ENDPOINT + "/show").session(session2)).andExpect(status().isOk())
        .andReturn();
    List<Client> clientList2 = getList(showResult2, Client.class);
    assertEquals(1, clientList2.size());

  }

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
