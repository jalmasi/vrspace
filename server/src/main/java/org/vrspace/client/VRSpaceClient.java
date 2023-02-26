package org.vrspace.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Enter;
import org.vrspace.server.dto.Session;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * A simple vrspace websocket client.
 * 
 * @author joe
 *
 */
@Slf4j
public class VRSpaceClient implements WebSocket.Listener, Runnable {
  private ObjectMapper mapper;
  private URI uri;
  private WebSocket ws;
  private List<Function<String, Void>> messageListeners = new ArrayList<>();
  private List<Function<Welcome, Void>> welcomeListeners = new ArrayList<>();
  private List<Function<VREvent, Void>> eventListeners = new ArrayList<>();
  private StringBuilder text = new StringBuilder();
  private CountDownLatch latch;
  private volatile Client client;
  private int errorCount = 0;
  private ScheduledFuture<?> task;
  private String world = null;
  private CompletableFuture<WebSocket> future;
  private Map<String, String> settings = null;
  public static final long TIMEOUT = 5000;
  public static final long RETRY = 10000;

  public VRSpaceClient(URI uri, ObjectMapper mapper) {
    this.uri = uri;
    this.mapper = mapper;
  }

  public CompletableFuture<WebSocket> connect() {
    latch = new CountDownLatch(1);
    future = new CompletableFuture<>();
    this.task = Executors.newSingleThreadScheduledExecutor().scheduleAtFixedRate(this, 0, RETRY, TimeUnit.MILLISECONDS);
    return future;
  }

  public void startSession() {
    send(new Session());
  }

  public void connectAndEnter(String world) {
    connectAndEnter(world, settings);
  }

  public void connectAndEnter(String world, Map<String, String> params) {
    connect().thenApply(ws -> {
      await();
      if (params != null) {
        this.settings = params;
        ClientRequest settings = new ClientRequest(getClient());
        params.entrySet().forEach((e) -> settings.addChange(e.getKey(), e.getValue()));
        send(settings);
      }
      enter(world);
      await();
      send(new Session());
      return ws;
    });
  }

  @Override
  public void run() {
    HttpClient.newHttpClient().newWebSocketBuilder().connectTimeout(Duration.ofMillis(TIMEOUT)).buildAsync(uri, this)
        .thenApply(ws -> {
          this.ws = ws;
          this.task.cancel(true);
          this.future.complete(ws);
          return ws;
        }).handle((ws, exception) -> {
          if (exception != null) {
            // too verbose
            // log.error("Websocket exception connecting to " + uri, exception);
            log.error("Websocket exception connecting to " + uri + " - " + exception);
          }
          return null;
        }).join();
  }

  /**
   * Add event listener to receive events from the server; an event is either a
   * Command or change to a VRObject
   */
  public VRSpaceClient addEventListener(Function<VREvent, Void> listener) {
    this.eventListeners.add(listener);
    return this;
  }

  /** Add a listener that receives all text messages from the server */
  public VRSpaceClient addMessageListener(Function<String, Void> listener) {
    this.messageListeners.add(listener);
    return this;
  }

  /** Welcome messages are received after connecting and entering a world */
  public VRSpaceClient addWelcomeListener(Function<Welcome, Void> listener) {
    this.welcomeListeners.add(listener);
    return this;
  }

  /** Hack, awaits for welcome message */
  public void await() {
    try {
      latch.await();
    } catch (InterruptedException e) {
      log.error("Unexpected interrupt: ", e);
    }
  }

  public Client getClient() {
    return this.client;
  }

  /** Enter a world */
  public void enter(String world) {
    send(new Enter(world));
    this.world = world;
  }

  /** Send a json string to the server */
  public void send(String arg) {
    this.ws.sendText(arg, true);
  }

  /** Send a request */
  public void send(ClientRequest req) {
    try {
      String text = mapper.writeValueAsString(req);
      log.debug("Sending " + text);
      this.ws.sendText(text, true);
    } catch (Exception e) {
      log.error("OOPS", e);
    }
  }

  /** Send a command */
  public void send(Command cmd) {
    ClientRequest req = new ClientRequest(this.client, cmd);
    send(req);
  }

  public int getErrorCount() {
    return errorCount;
  }

  @Override
  public void onOpen(WebSocket webSocket) {
    log.info("Connected to " + uri);
    WebSocket.Listener.super.onOpen(webSocket);
  }

  @Override
  public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
    log.debug("Received " + last + ":" + data);
    text.append(data);
    if (last) {
      String message = text.toString();
      messageListeners.forEach(l -> l.apply(message));
      text = new StringBuilder();
      try {
        // TODO this should work with deserialization out of the box
        // introduce ERROR class etc
        if (message.startsWith("{\"Welcome\":{")) {
          Welcome welcome = mapper.readValue(message, Welcome.class);
          this.client = welcome.getClient();
          latch.countDown();
          welcomeListeners.forEach(l -> l.apply(welcome));
        } else if (message.startsWith("{\"ERROR\"")) {
          errorCount++;
        } else {
          VREvent event = mapper.readValue(message, VREvent.class);
          eventListeners.forEach(l -> l.apply(event));
        }
      } catch (Exception e) {
        log.error("Message parsing or processing error", e);
      }
    }

    CompletionStage<?> ret = WebSocket.Listener.super.onText(webSocket, data, last);
    return ret;
  }

  @Override
  public void onError(WebSocket webSocket, Throwable error) {
    log.error("Websocket error " + webSocket);
    connectAndEnter(this.world);
    WebSocket.Listener.super.onError(webSocket, error);
  }

  @Override
  public CompletionStage<?> onPing(WebSocket webSocket, ByteBuffer message) {
    // log.debug("Ping received " + webSocket);
    return WebSocket.Listener.super.onPing(webSocket, message);
  }

  @Override
  public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
    log.debug("Socket closed: " + statusCode + " " + reason);
    connectAndEnter(this.world);
    return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
  }
}
