package org.vrspace.server.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

@WebMvcTest(controllers = WorldController.class, excludeAutoConfiguration = { SecurityAutoConfiguration.class })
public class WorldControllerTest {
  private static String ENDPOINT = WorldController.PATH;

  @Autowired
  private MockMvc mockMvc;

  @MockBean
  private VRObjectRepository db;
  @MockBean
  private ClientFactory clientFactory;
  @MockBean
  private WorldManager manager;

  @Captor
  private ArgumentCaptor<World> worldCaptor;

  private MockHttpSession session = new MockHttpSession();

  @Test
  public void testList() throws Exception {
    mockMvc.perform(get(ENDPOINT + "/list").session(session)).andExpect(status().isOk()).andReturn();
  }

  @Test
  public void testCreateEmpty() throws Exception {
    mockMvc.perform(post(ENDPOINT + "/create").session(session)).andExpect(status().isBadRequest());
  }

  @Test
  public void testCreateByAnonymous() throws Exception {
    when(clientFactory.clientNameAttribute()).thenReturn(ClientFactory.CLIENT_NAME_ATTRIBUTE);
    mockMvc.perform(post(ENDPOINT + "/create").param("worldName", "test").session(session))
        .andExpect(status().isForbidden());
  }

  @Test
  public void testCreateByNonExistingUser() throws Exception {
    when(clientFactory.clientNameAttribute()).thenReturn(ClientFactory.CLIENT_NAME_ATTRIBUTE);
    session.setAttribute(ClientFactory.CLIENT_NAME_ATTRIBUTE, "testUser");
    mockMvc.perform(post(ENDPOINT + "/create").param("worldName", "test").session(session))
        .andExpect(status().isForbidden());
  }

  // @Test
  public void testCreateFromInvalidTemplate() throws Exception {
    when(clientFactory.clientNameAttribute()).thenReturn(ClientFactory.CLIENT_NAME_ATTRIBUTE);
    session.setAttribute(ClientFactory.CLIENT_NAME_ATTRIBUTE, "testUser");
    when(manager.getClientByName(any(String.class))).thenReturn(new Client("testUser"));

    mockMvc.perform(
        post(ENDPOINT + "/create").param("worldName", "test").param("templateWorldName", "whatever").session(session))
        .andExpect(status().isPreconditionRequired());
  }

  @Test
  public void testCreateValid() throws Exception {
    Client client = new Client("testUser");

    when(clientFactory.clientNameAttribute()).thenReturn(ClientFactory.CLIENT_NAME_ATTRIBUTE);
    session.setAttribute(ClientFactory.CLIENT_NAME_ATTRIBUTE, "testUser");
    when(manager.getClientByName(any(String.class))).thenReturn(client);
    when(manager.saveWorld(worldCaptor.capture())).thenAnswer(i -> i.getArguments()[0]);

    MvcResult result = mockMvc.perform(post(ENDPOINT + "/create").param("worldName", "test").session(session))
        .andExpect(status().isCreated()).andReturn();
    String token = result.getResponse().getContentAsString();

    // wrong format causes IllegalArgumentException:
    System.out.println("Returned token: " + UUID.fromString(token));
    // world token matches the returned value
    assertEquals(token, worldCaptor.getValue().getToken());
  }
}
