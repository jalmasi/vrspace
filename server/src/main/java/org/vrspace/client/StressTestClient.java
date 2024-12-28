package org.vrspace.client;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.obj.Point;

import com.fasterxml.jackson.databind.ObjectMapper;

public class StressTestClient {
  private int maxClients = 20;
  private int requestsPerSecondEach = 5;
  // private String world = "StressTest";
  private String world = "template";
  private Double deltaX, deltaY, deltaZ = 0.1;
  private Point spawnPoint = new Point(0, 0, 0);
  private Double spawnRadius = 10.0;
  // requires valid cert:
  // private URI uri = URI.create("wss://localhost/vrspace/server");
  private URI uri = URI.create("ws://localhost:8080/vrspace/client");
  private String avatarMesh = "/babylon/dolphin.glb";

  private void start() {
    ObjectMapper objectMapper = new JacksonConfig().objectMapper();
    for (int i = 0; i < maxClients; i++) {
      VRSpaceClient client = new VRSpaceClient(uri, objectMapper);
      String name = world + "-" + i;
      Map<String, String> params = new HashMap<>();
      params.put("name", name);
      params.put("mesh", avatarMesh);

      client.addErrorListener(s -> {
        System.err.println(name + ": " + s);
        return null;
      });
      client.connectAndEnter(world, params);
    }
  }

  public static void main(String[] args) {
    new StressTestClient().start();
  }
}
