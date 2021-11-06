package org.vrspace.server.obj;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.springframework.beans.factory.annotation.Autowired;
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
  ObjectMapper mapper;

  Set<VRObject> transforms = new HashSet<VRObject>();
  Set<VRObject> permanents = new HashSet<VRObject>();
  VRObject active = new VRObject(1L, 0, 0, 0, new VRObject(11L).active()).active();
  Client client = new Client();

  @BeforeEach
  public void setup() throws Exception {
    when(playingSession.isOpen()).thenReturn(true);

    transforms.add(active);
    transforms.add(new VRObject(2L, 1, 0, 0).passive());

    permanents.add(new VRObject(101L, new VRObject(12L)));
    permanents.add(new VRObject(202L));

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

  private void record(EventRecorder recorder) {
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
    record(recorder);

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
    record(recorder);

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
    record(recorder);

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
}
