package org.vrspace.server.obj;

import java.util.concurrent.ConcurrentLinkedQueue;
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
  private ConcurrentLinkedQueue<Event> events = new ConcurrentLinkedQueue<Event>();

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

  enum EventType {
    own, space, scene
  }

  class Event {
    long delay;
    EventType type;
    Object event;

    public Event(long delay, EventType type, Object event) {
      this.delay = delay;
      this.type = type;
      this.event = event;
    }
  }

  @Override
  public void sendMessage(Object obj) {
    if (recording) {
      long delay = System.currentTimeMillis() - start;
      if (obj instanceof VREvent) {
        VREvent event = (VREvent) obj;
        if (event.getSource() == client) {
          log.debug("Recording own message " + delay + ":" + obj);
          events.add(new Event(delay, EventType.own, obj));
        } else {
          log.debug("Recording space event " + delay + ":" + obj);
          events.add(new Event(delay, EventType.space, obj));
        }
      } else {
        log.debug("Recording scene update " + delay + ":" + obj);
        events.add(new Event(delay, EventType.scene, obj));
      }
    }
  }

  public void play(Client viewer) {
    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    events.forEach((event) -> executor.schedule(() -> playEvent(event, viewer), event.delay, TimeUnit.MILLISECONDS));
    executor.shutdown();
  }

  private void playEvent(Event event, Client viewer) {
    log.debug("Playing " + event.event);
    try {
      viewer.sendMessage(event.event);
    } catch (Exception e) {
      log.error("Error playing event " + event.event, e);
    }
  }

  public ConcurrentLinkedQueue<Event> getEvents() {
    return events;
  }

}
