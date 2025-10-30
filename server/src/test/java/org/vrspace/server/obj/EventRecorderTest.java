package org.vrspace.server.obj;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

/**
 * This is a bad test using hardcoded timeouts. It may fail occasionally until
 * EventRecorder provides some additional notifications, e.g. that the loop has
 * ended.
 * 
 * @author joe
 *
 */
@Slf4j
@SpringBootTest(classes = JacksonConfig.class)
public class EventRecorderTest {
  @Mock
  WorldManager worldManager;
  @Mock
  ConcurrentWebSocketSessionDecorator recordingSession;
  @Mock
  ConcurrentWebSocketSessionDecorator playingSession;
  @Captor
  private ArgumentCaptor<WebSocketMessage<?>> message;

  @Autowired
  @Qualifier("objectMapper")
  ObjectMapper mapper;

  Set<VRObject> transforms = new HashSet<VRObject>();
  Set<VRObject> permanents = new HashSet<VRObject>();
  VRObject active = new VRObject("2", 0, 0, 0, new VRObject("11").active()).active();
  Client client = new Client();

  @BeforeEach
  public void setup() throws Exception {
    when(playingSession.isOpen()).thenReturn(true);

    transforms.add(active);
    transforms.add(new VRObject("2", 1, 0, 0).passive());

    permanents.add(new VRObject("101", new VRObject("12")));
    permanents.add(new VRObject("202"));

    when(worldManager.getRange(any(Client.class), any(Point.class), any(Point.class))).thenReturn(transforms);
    when(worldManager.getPermanents(any(Client.class))).thenReturn(permanents);

    doNothing().when(playingSession).sendMessage(message.capture());

    // recording client
    client.setPosition(new Point());
    client.setMapper(mapper);
    client.setSceneProperties(new SceneProperties());
    client.setSession(recordingSession);
    Scene scene = new Scene(worldManager, client);
    client.setScene(scene);
  }

  private void recordEvents(EventRecorder recorder) {
    int expected = 0;
    // recording own event:
    VREvent ownEvent = new VREvent(client, client);
    ownEvent.addChange("mesh", "dolphin.glb");
    client.notifyListeners(ownEvent);
    assertEquals(++expected, recorder.getEvents().size());

    // scene update should be the same:
    client.getScene().update();
    if (recorder.isRecordScene()) {
      recorder.getScene().update();
      expected++;
    }
    assertEquals(expected, recorder.getEvents().size());

    // event from another client/active object:
    VREvent otherEvent = new VREvent(active, client);
    otherEvent.addChange("name", "renamed");
    active.notifyListeners(otherEvent);
    if (recorder.isRecordScene()) {
      expected++;
    }
    assertEquals(expected, recorder.getEvents().size());
  }

  @Test
  public void testRecordSceneAndPlayClient() throws Exception {
    System.out.println("testRecordSceneAndPlayClient");
    // start recording
    EventRecorder recorder = new EventRecorder(worldManager, client, "test");
    recorder.setLoop(false);
    recorder.init(worldManager, client);
    recorder.start();

    // record, assert changes
    recordEvents(recorder);

    // stop recording
    recorder.stop();
    // make sure recording has stopped
    client.notifyListeners(new VREvent(client, client));
    assertEquals(3, recorder.getEvents().size());

    // playing client
    Client viewer = new Client();
    viewer.setMapper(mapper);
    viewer.setSession(playingSession);

    // test playing
    recorder.play(viewer);
    Thread.sleep(200);

    // all recorded events sent to the viewer
    verify(playingSession, times(3)).sendMessage(any(TextMessage.class));
  }

  @Test
  public void testRecordSceneAndLoopClient() throws Exception {
    System.out.println("testRecordSceneAndLoopClient");
    // start recording
    EventRecorder recorder = new EventRecorder(worldManager, client, "test");
    recorder.init(worldManager, client);
    recorder.setLoop(true);
    recorder.start();

    // record, assert changes
    recordEvents(recorder);

    // stop recording
    recorder.stop();
    assertEquals(3, recorder.getEvents().size());
    // make sure recording has stopped
    client.notifyListeners(new VREvent(client, client));
    assertEquals(3, recorder.getEvents().size());

    // playing client
    Client viewer = new Client();
    viewer.setMapper(mapper);
    viewer.setSession(playingSession);

    // test playing
    recorder.play(viewer);
    // wait first loop
    wait(recorder);
    recorder.setLoop(false);
    // wait current loop to terminate
    wait(recorder);
    // it may play another one
    wait(recorder);
    verify(playingSession, atLeast(4)).sendMessage(any(TextMessage.class));
    clearInvocations(playingSession);
    Thread.sleep(200);
    verifyNoMoreInteractions(playingSession);
  }

  @Test
  public void testRecordClientAndLoop() throws Exception {
    // start recording
    EventRecorder recorder = new EventRecorder(worldManager, client, "test");
    recorder.setRecordScene(false);
    recorder.init(worldManager, client);
    recorder.setLoop(true);
    recorder.start();

    // record, assert changes
    recordEvents(recorder);

    // stop recording
    recorder.stop();
    assertEquals(1, recorder.getEvents().size());
    // make sure recording has stopped
    client.notifyListeners(new VREvent(client, client));
    assertEquals(1, recorder.getEvents().size());

    // playing client
    Client viewer = new Client();
    viewer.setMapper(mapper);
    viewer.setSession(playingSession);

    // test playing for a few times
    recorder.play(viewer);
    wait(recorder);
    // stop
    recorder.setLoop(false);
    wait(recorder);
    // now it may play one last loop
    wait(recorder);
    verify(playingSession, atLeast(2)).sendMessage(any(TextMessage.class));
    clearInvocations(playingSession);
    Thread.sleep(200);
    verifyNoMoreInteractions(playingSession);
  }

  private void wait(EventRecorder recorder) throws Exception {
    log.debug("Waiting for " + recorder.getRestart().isShutdown() + " " + recorder.getRestart().isTerminated());
    recorder.getRestart().awaitTermination(1, TimeUnit.SECONDS);
    if (recorder.getRestart().isShutdown() && recorder.getRestart().isTerminated()) {
      // give it some more time to process events
      Thread.sleep(100);
    }
  }

  @Test
  public void testEventDeserialization() {
    EventRecorder recorder = new EventRecorder();
    recorder.setMapper(mapper);
    PersistentEvent event1 = new PersistentEvent();
    event1.setDelay(10);
    event1.setType("own");
    event1.setPayload("{\"rotation\": {\"x\": 1,\"y\": 0,\"z\": 0}}");
    PersistentEvent event2 = new PersistentEvent();
    event2.setDelay(20);
    event2.setType("own");
    event2.setPayload("{\"rotation\": {\"x\": 2,\"y\": 0,\"z\": 0}}");
    PersistentEvent event3 = new PersistentEvent();
    event3.setDelay(30);
    event3.setType("own");
    event3.setPayload("{\"rotation\": {\"x\": 3,\"y\": 0,\"z\": 0}}");
    recorder.setEvents(List.of(event1, event2, event3));

    recorder.getEvents().forEach(event -> {
      assertNull(event.getChanges());
    });

    recorder.getEvents().forEach(event -> recorder.deserialize(event));

    recorder.getEvents().forEach(event -> {
      assertNotNull(event.getChanges());
      assertFalse(event.getChanges().isEmpty());
    });
  }
}
