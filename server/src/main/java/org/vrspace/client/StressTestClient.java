package org.vrspace.client;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.obj.Point;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class StressTestClient {
  private int maxClients = 100;
  private long requestsPerSecondEach = 5;
  // give it a few seconds to ensure everybody is connected and ready before
  // events start, or start right away to test concurrency of session startup
  private long initialDelay = 0;
  private int runSeconds = 60;
  // private String world = "StressTest";
  private String world = "template";
  // private String world = "galaxy";
  // eventually, specify movement along axes:
  // private Double deltaX, deltaY, deltaZ = 0.1;
  private Point spawnPoint = new Point(0, 0, 0);
  private Double spawnRadius = Double.valueOf(maxClients / 2);
  // requires valid cert:
  // private URI uri = URI.create("wss://www.vrspace.org/vrspace/client");
  private URI uri = URI.create("ws://localhost:8080/vrspace/client");
  // private String avatarMesh = "/babylon/dolphin.glb";
  private String avatarMesh = "/content/char/female/gracy_lee/scene.gltf";
  private List<VRSpaceClient> clients = new ArrayList<>(maxClients);

  private Status status = new Status();

  private void start() throws Exception {
    ObjectMapper objectMapper = new JacksonConfig().objectMapper();
    int threads = Runtime.getRuntime().availableProcessors() / 2;
    ScheduledExecutorService executor = Executors.newScheduledThreadPool(threads);

    // connect all clients first
    for (int i = 0; i < maxClients; i++) {
      VRSpaceClient client = new VRSpaceClient(uri, objectMapper);
      String name = world + "-" + i;
      Map<String, String> params = new HashMap<>();
      params.put("name", name);
      params.put("mesh", avatarMesh);
      // params.put("humanoid", "false"); // with dolphin

      client.addErrorListener(s -> {
        status.errors.incrementAndGet();
        System.err.println(name + ": " + s);
      });

      // only used to stress-test new connections
      // client.connectAndEnterAsync(world, params);
      client.connectAndEnterSync(world, params);
      client.addEventListener(e -> {
        status.requestsReceived.incrementAndGet();
        status.bytesReceived.addAndGet(e.getPayload().length());
      });

      long period = 1000 / requestsPerSecondEach;
      // CHECKME: initial delay?
      executor.scheduleAtFixedRate(new Sender(client), initialDelay, period, TimeUnit.MILLISECONDS);
    }

    if (runSeconds > 0) {
      Thread.sleep(runSeconds * 1000);
      executor.shutdownNow();
      executor.awaitTermination(1, TimeUnit.SECONDS);
      // sleep some more, they still may be receiving
      Thread.sleep(1000);
      this.clients.forEach(c -> c.disconnect());
      log.info("Done, " + status);
      System.exit(0);
    }
  }

  public static void main(String[] args) throws Exception {
    new StressTestClient().start();
  }

  public class Sender implements Runnable {
    private VRSpaceClient client;
    private Point pos = new Point(spawnPoint.getX() + spawnRadius * Math.random(), spawnPoint.getY(),
        spawnPoint.getZ() + spawnRadius * Math.random());

    public Sender(VRSpaceClient client) {
      this.client = client;
    }

    public void run() {
      ClientRequest req = new ClientRequest(client.getClient());
      // Point pos = client.getClient().getPosition();
      req.addChange("position", new Point(randomPos(pos.getX()), randomPos(pos.getY()), randomPos(pos.getZ())));
      String payload = client.send(req);
      status.requestsSent.incrementAndGet();
      status.bytesSent.addAndGet(payload.length());
    }

    private Double randomPos(double pos) {
      return pos + Math.random();
    }
  }

  public class Status {
    public AtomicInteger requestsSent = new AtomicInteger();
    public AtomicLong bytesSent = new AtomicLong();
    public AtomicInteger requestsReceived = new AtomicInteger();
    public AtomicLong bytesReceived = new AtomicLong();
    public AtomicInteger errors = new AtomicInteger();

    public String toString() {
      return "Sent - requests: " + requestsSent + " bytes: " + bytesSent + " Received - requests: " + requestsReceived
          + " bytes: " + bytesReceived + " Errors: " + errors;
    }
  }
}
