package org.vrspace.server.api;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.vrspace.server.config.SeleniumConfig;

@WebMvcTest(SeleniumController.class)
@Import({ SeleniumConfig.class, SecurityAutoConfiguration.class })
public class SeleniumControllerIT {
  @Autowired
  private MockMvc mockMvc;

  private MockHttpSession session = new MockHttpSession();

  @Test
  public void testAvailable() throws Exception {
    mockMvc.perform(get("/webbrowser/available")).andExpect(status().isOk());
  }

  @Test
  public void testSession() throws Exception {
    assumeTrue(isAvailable());

    // browse to a well-known page;)
    MvcResult getResult = mockMvc.perform(get("/webbrowser/get?url=https://www.vrspace.org").session(session))
        .andExpect(status().isOk()).andReturn();
    assertScreenshot(getResult);

    // click; this opens a new tab
    MvcResult clickResult = mockMvc.perform(get("/webbrowser/click?x=1800&y=12").session(session))
        .andExpect(status().isOk()).andReturn();
    assertScreenshot(clickResult);

    // scroll down
    MvcResult scrollResult = mockMvc.perform(get("/webbrowser/scroll?pixels=512").session(session))
        .andExpect(status().isOk()).andReturn();
    assertScreenshot(scrollResult);

    // back
    MvcResult backResult = mockMvc.perform(get("/webbrowser/back").session(session)).andExpect(status().isOk())
        .andReturn();
    assertScreenshot(backResult);

    // forward
    MvcResult forwardResult = mockMvc.perform(get("/webbrowser/back").session(session)).andExpect(status().isOk())
        .andReturn();
    assertScreenshot(forwardResult);

    // close a tab
    MvcResult closeResult = mockMvc.perform(get("/webbrowser/close").session(session)).andExpect(status().isOk())
        .andReturn();
    assertScreenshot(closeResult);

    // close the browser
    mockMvc.perform(get("/webbrowser/close").session(session)).andExpect(status().isNoContent());

    // quit the browser
    mockMvc.perform(get("/webbrowser/quit").session(session)).andExpect(status().isOk());

  }

  private void assertScreenshot(MvcResult result) {
    assertTrue(result.getResponse().getContentLength() > 0);
    assertTrue(result.getResponse().getContentAsByteArray().length > 10000);
  }

  private boolean isAvailable() throws Exception {
    MvcResult result = mockMvc.perform(get("/webbrowser/available")).andExpect(status().isOk()).andReturn();
    System.err.println("Browser available: " + result.getResponse().getContentAsString());
    return "true".equals(result.getResponse().getContentAsString());
  }
}
