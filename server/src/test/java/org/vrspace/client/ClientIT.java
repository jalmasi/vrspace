package org.vrspace.client;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Session;
import org.vrspace.server.dto.Welcome;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@SpringBootTest(classes = JacksonConfig.class)
@Disabled
public class ClientIT {
  @Autowired
  ObjectMapper mapper;

  @Test
  public void testConnect() throws Exception {
    VRSpaceClient client = connectToVRSpace();
    client.connectAndEnter("galaxy");
    Thread.sleep(1000);
    assertEquals(0, client.getErrorCount());
    Thread.sleep(1000 * 60 * 60);
  }

  private VRSpaceClient connectToVRSpace() {
    URI uri = URI.create("ws://localhost:8080/vrspace/server");
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
    for (int i = 0; i < 100; i++) {
      URI uri = URI.create("ws://localhost:8080/vrspace/server");
      VRSpaceClient client = new VRSpaceClient(uri, mapper).addMessageListener((s) -> messageReceived(s))
          .addWelcomeListener(w -> welcomeReceived(w));
      client.await();
      client.enter("galaxy");
      client.await();
      ClientRequest changes = new ClientRequest(client.getClient());
      // changes.addChange("url", "https://server" + i + ".vrspace.org/");
      changes.addChange("url", "https://localhost/babylon/avatar-selection.html");
      changes.addChange("thumbnail", "/content/worlds/galaxy.jpg");
      client.send(changes);
      client.send(new Session());
    }
    Thread.sleep(1000 * 60 * 60);
  }
}
