package org.vrspace.server.obj;

import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.vrspace.server.core.Scene;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.VREvent;

import lombok.extern.slf4j.Slf4j;

/**
 * Records all events in the world, plays them back.
 * 
 * @author joe
 *
 */
@Slf4j
public class EventRecorder extends Client {
  private Client client;
  private boolean recording = false;
  private long start = 0;
  private ConcurrentSkipListMap<Long, Object> events = new ConcurrentSkipListMap<Long, Object>();

  public EventRecorder(WorldManager worldManager, Client c) {
    this.client = c;
    this.setSceneProperties(c.getSceneProperties());
    this.setPosition(c.getPosition());
    // record everything a client sends:
    client.addListener(this);
    // scene records everything that a client sees:
    setScene(new Scene(worldManager, this));
  }

  public void start() {
    this.recording = true;
    this.start = System.currentTimeMillis();
  }

  public void stop() {
    this.recording = false;
  }

  @Override
  public void sendMessage(Object obj) {
    if (recording) {
      long delay = System.currentTimeMillis() - start;
      if (obj instanceof VREvent) {
        VREvent event = (VREvent) obj;
        if (event.getSource() == client) {
          log.debug("Recording own message:" + obj);
        } else {
          log.debug("Recording space event:" + obj);
        }
      } else {
        log.debug("Recording scene update:" + obj);
      }
      events.put(delay, obj);
    }
  }

  public void play() {
    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    events.forEach((delay, event) -> executor.schedule(() -> playEvent(event), delay, TimeUnit.MILLISECONDS));
    executor.shutdown();
  }

  private void playEvent(Object event) {
    log.debug("Playing " + event);
  }

  public ConcurrentSkipListMap<Long, Object> getEvents() {
    return events;
  }

}
