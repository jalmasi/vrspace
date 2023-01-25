package org.vrspace.client;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.URI;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Session;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@SpringBootTest(classes = JacksonConfig.class)
public class ClientIT {
  @Autowired
  ObjectMapper mapper;

  @Test
  public void testSomething() throws Exception {
    VRSpaceClient client = connectToVRSpace();
    client.await();
    Client c = client.getClient();
    ClientRequest req = new ClientRequest(c);
    req.addChange("mesh", "/babylon/dolphin.glb");
    client.send(req);
    client.send(new Session());
    client.enter("servers");
    client.await();
    client.send(new Session());
    Thread.sleep(1000);
    assertEquals(0, client.getErrorCount());
  }

  public VRSpaceClient connectToVRSpace() {
    URI uri = URI.create("wss://www.vrspace.org/vrspace");
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
}
