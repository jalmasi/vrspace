package org.vrspace.server.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.vrspace.server.config.WebSecurityConfig;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;

@WebMvcTest(WorldController.class)
@ImportAutoConfiguration(classes = WebSecurityConfig.class)
//@Import({ SecurityAutoConfiguration.class, ServerConfig.class, WebSecurityConfig.class })
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

  private MockHttpSession session = new MockHttpSession();

  @Test
  public void testList() throws Exception {
    MvcResult result = mockMvc.perform(get(ENDPOINT + "/list").session(session)).andExpect(status().isOk()).andReturn();
  }

  @Test
  public void testCreate() throws Exception {
    MvcResult result = mockMvc.perform(post(ENDPOINT + "/create").session(session)).andExpect(status().isOk())
        .andReturn();
  }
}
