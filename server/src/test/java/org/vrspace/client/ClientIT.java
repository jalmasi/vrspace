package org.vrspace.client;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.dto.Welcome;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@SpringBootTest(classes = { JacksonConfig.class, ServerConfig.class })
@Disabled("Not an automated integration test - requires server to be running locally")
public class ClientIT {
  @Autowired
  ObjectMapper mapper;
  @Autowired
  ServerConfig serverConfig;

  @Test
  public void testConnect() throws Exception {
    VRSpaceClient client = connectToVRSpace();
    client.connectAndEnter("galaxy", Map.of("url", serverConfig.getServerUrl(), "thumbnail",
        serverConfig.getServerThumbnail(), "description", serverConfig.getServerDescripton()));
    Thread.sleep(1000);
    assertEquals(0, client.getErrorCount());
    Thread.sleep(1000 * 60 * 60);
  }

  private VRSpaceClient connectToVRSpace() {
    URI uri = URI.create("ws://localhost:8080/vrspace/server");
    // URI uri = URI.create("wss://www.vrspace.org/vrspace/server");
    VRSpaceClient client = new VRSpaceClient(uri, mapper).addMessageListener((s) -> messageReceived(s))
        .addWelcomeListener(w -> welcomeReceived(w));
    return client;
  }

  private Void messageReceived(String s) {
    log.debug("Received " + s);
    return null;
  }

  private Void welcomeReceived(Welcome w) {
    log.debug("Welcome received: " + w);
    return null;
  }

  @Test
  public void connectSomeServersToLocalhost() throws InterruptedException {
    for (int i = 0; i < 10; i++) {
      VRSpaceClient client = connectToVRSpace();
      // client.connectAndEnter("galaxy");
      client.connectAndEnter("galaxy",
          Map.of("url", serverConfig.getServerUrl(), "thumbnail", serverConfig.getServerThumbnail(), "description",
              serverConfig.getServerDescripton() + i, "available", "" + (Math.floorMod(i, 2) == 0)));
      Thread.sleep(100);
    }
    Thread.sleep(1000 * 60 * 60);
  }
}
