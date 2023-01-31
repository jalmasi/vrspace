package org.vrspace.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.function.Function;

import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Enter;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * A simple vrspace websocket client.
 * 
 * @author joe
 *
 */
@Slf4j
public class VRSpaceClient implements WebSocket.Listener {
  private ObjectMapper mapper;
  private URI uri;
  private WebSocket ws;
  private List<Function<String, Void>> messageListeners = new ArrayList<>();
  private List<Function<Welcome, Void>> welcomeListeners = new ArrayList<>();
  private List<Function<VREvent, Void>> eventListeners = new ArrayList<>();
  private StringBuilder text = new StringBuilder();
  private CountDownLatch latch = new CountDownLatch(1);
  private Client client;
  private int errorCount = 0;

  public VRSpaceClient(URI uri, ObjectMapper mapper) {
    this.uri = uri;
    this.mapper = mapper;
    this.ws = HttpClient.newHttpClient().newWebSocketBuilder().buildAsync(uri, this).join();
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
    latch = new CountDownLatch(1);
    send(new Enter(world));
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
    } catch (JsonProcessingException e) {
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
        if (message.startsWith("{\"Welcome\":{")) {
          Welcome welcome = mapper.readValue(message, Welcome.class);
          if (this.client == null) {
            this.client = welcome.getClient();
          }
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
    WebSocket.Listener.super.onError(webSocket, error);
  }

  @Override
  public CompletionStage<?> onPing(WebSocket webSocket, ByteBuffer message) {
    // log.debug("Ping received " + webSocket);
    return WebSocket.Listener.super.onPing(webSocket, message);
  }
}
