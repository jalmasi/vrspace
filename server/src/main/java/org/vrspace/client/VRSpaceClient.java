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
import java.util.function.Consumer;

import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Enter;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.SceneChange;
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
  private List<Consumer<String>> messageListeners = new ArrayList<>();
  private List<Consumer<Welcome>> welcomeListeners = new ArrayList<>();
  private List<Consumer<VREvent>> eventListeners = new ArrayList<>();
  private List<Consumer<SceneChange>> sceneListeners = new ArrayList<>();
  private List<Consumer<String>> errorListeners = new ArrayList<>();
  private StringBuilder text = new StringBuilder();
  private CountDownLatch welcomeLatch;
  private CountDownLatch commandLatch;
  private volatile Client client;
  private int errorCount = 0;
  private ScheduledFuture<?> reconnect;
  private String world = null;
  private volatile CompletableFuture<WebSocket> connecting;
  private volatile CompletableFuture<WebSocket> sending;
  private volatile boolean reconnectOnClose = true;
  private Map<String, String> settings = null;
  public static final long TIMEOUT = 5000;
  public static final long RETRY = 10000;

  public VRSpaceClient(URI uri, ObjectMapper mapper) {
    this.uri = uri;
    this.mapper = mapper;
  }

  public CompletableFuture<WebSocket> connect() {
    welcomeLatch = new CountDownLatch(1);
    connecting = new CompletableFuture<>();
    this.reconnect = Executors.newSingleThreadScheduledExecutor().scheduleAtFixedRate(this, 0, RETRY,
        TimeUnit.MILLISECONDS);
    return connecting;
  }

  public void startSession() {
    commandLatch = new CountDownLatch(1);
    send(new Session());
    await(commandLatch);
  }

  public void connectAndEnter(String world) {
    connectAndEnterSync(world, settings);
  }

  public void disconnect() {
    this.reconnectOnClose = false;
    this.ws.sendClose(WebSocket.NORMAL_CLOSURE, "bye");
  }

  @Override
  public void run() {
    HttpClient.newHttpClient().newWebSocketBuilder().connectTimeout(Duration.ofMillis(TIMEOUT)).buildAsync(uri, this)
        .thenApply(ws -> {
          this.ws = ws;
          this.reconnect.cancel(true);
          this.connecting.complete(ws);
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
   * Connect, and then set own parameters (e.g. avatar), then enter a world. Does
   * not block until the connection has been made, but returns immediately. Use
   * case - stress testing.
   * 
   * @param world  name of the world to enter
   * @param params own properties to set before entering the world
   */
  public void connectAndEnterAsync(String world, Map<String, String> params) {
    connect().thenApply(ws -> {
      await(welcomeLatch);
      if (params != null) {
        this.settings = params;
        ClientRequest settings = new ClientRequest(getClient());
        params.entrySet().forEach((e) -> settings.addChange(e.getKey(), e.getValue()));
        send(settings);
      }
      enterSync(world);
      startSession();
      return ws;
    });
  }

  /**
   * Connect, set own parameters (e.g. avatar), then enter a world. Wait for
   * connection and session to be set up, and then return. Typical use case when
   * connecting to a server.
   * 
   * @param world  name of the world to enter
   * @param params own properties to set before entering the world
   */
  public void connectAndEnterSync(String world, Map<String, String> params) {
    try {
      connect().get();
      await(welcomeLatch);
      if (params != null) {
        this.settings = params;
        ClientRequest settings = new ClientRequest(getClient());
        params.entrySet().forEach((e) -> settings.addChange(e.getKey(), e.getValue()));
        send(settings);
      }
      enterSync(world);
      startSession();
    } catch (Exception e) {
      log.error("Can't connect", e);
    }
  }

  /**
   * Add event listener to receive events from the server (changes to VRObjects)
   */
  public VRSpaceClient addEventListener(Consumer<VREvent> listener) {
    this.eventListeners.add(listener);
    return this;
  }

  /**
   * Add scene listener that receives changes to the scene - Add and Remove
   * commands.
   */
  public VRSpaceClient addSceneListener(Consumer<SceneChange> listener) {
    this.sceneListeners.add(listener);
    return this;
  }

  /**
   * Add an error listener that is passed JSON error message received from the
   * server.
   */
  public VRSpaceClient addErrorListener(Consumer<String> listener) {
    this.errorListeners.add(listener);
    return this;
  }

  /** Add a listener that receives all text messages from the server */
  public VRSpaceClient addMessageListener(Consumer<String> listener) {
    this.messageListeners.add(listener);
    return this;
  }

  /** Welcome messages are received after connecting and entering a world */
  public VRSpaceClient addWelcomeListener(Consumer<Welcome> listener) {
    this.welcomeListeners.add(listener);
    return this;
  }

  /** Hack, awaits for welcome message */
  public void await(CountDownLatch latch) {
    try {
      long time = System.currentTimeMillis();
      latch.await();
      log.debug("Waited " + (System.currentTimeMillis() - time) + " ms");
    } catch (InterruptedException e) {
      log.error("Unexpected interrupt: ", e);
    }
  }

  public Client getClient() {
    return this.client;
  }

  /** Enter a world, and wait for welcome */
  public void enterSync(String world) {
    welcomeLatch = new CountDownLatch(1);
    send(new Enter(world));
    await(welcomeLatch);
    this.world = world;
  }

  /** Enter a world, do not wait for Welcome response */
  public void enterAsync(String world) {
    send(new Enter(world));
    this.world = world;
  }

  /** Send a json string to the server */
  public void send(String arg) {
    this.ws.sendText(arg, true);
  }

  /** Send a request */
  public String send(ClientRequest req) {
    try {
      String text = mapper.writeValueAsString(req);
      log.debug("Sending " + text);
      if (sending != null) {
        sending.join();
      }
      sending = this.ws.sendText(text, true);
      sending.exceptionally((err) -> {
        log.error("Send error", err);
        return ws;
      });
      return text;
    } catch (Exception e) {
      log.error("OOPS", e);
      return "";
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
      messageListeners.forEach(l -> l.accept(message));
      text = new StringBuilder();
      try {
        // TODO this should work with deserialization out of the box
        // introduce ERROR class etc
        if (message.startsWith("{\"Welcome\":{")) {
          Welcome welcome = mapper.readValue(message, Welcome.class);
          this.client = welcome.getClient();
          welcomeLatch.countDown();
          welcomeListeners.forEach(l -> l.accept(welcome));
        } else if (message.startsWith("{\"Add\":{\"")) {
          Add add = mapper.readValue(message, Add.class);
          sceneListeners.forEach(l -> l.accept(add));
        } else if (message.startsWith("{\"Remove\":{\"")) {
          Remove remove = mapper.readValue(message, Remove.class);
          sceneListeners.forEach(l -> l.accept(remove));
        } else if (message.startsWith("{\"response\":")) {
          commandLatch.countDown();
        } else if (message.startsWith("{\"ERROR\"")) {
          errorCount++;
          errorListeners.forEach(l -> l.accept(message));
        } else {
          VREvent event = mapper.readValue(message, VREvent.class);
          event.setPayload(message);
          eventListeners.forEach(l -> l.accept(event));
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
    if (this.reconnectOnClose) {
      connectAndEnter(this.world);
    }
    return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
  }
}
