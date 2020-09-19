package org.vrspace.server.obj;

import java.util.Collection;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.neo4j.ogm.annotation.Transient;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Recording;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.ObjectReader;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * Records all events in the world, saves them to the database, plays them back.
 * This is a special case of Client that has no session, but copies scene and
 * properties from the client it impersonates. By overriding Client's
 * sendMessage(), it maintains internal list of received events. Once recording
 * is done, i.e. stop() is called, event list is persisted to the database.
 * 
 * @see PersistentEvent
 * @see Recording
 * @author joe
 *
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = false, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
public class EventRecorder extends Client {
  private boolean recordClient = true;
  private boolean recordScene = true;
  private boolean loop = true;
  // @JsonIgnore
  // private Event[] recorded;
  @JsonIgnore
  private ConcurrentLinkedQueue<PersistentEvent> events = new ConcurrentLinkedQueue<PersistentEvent>();
  @JsonIgnore
  @Transient
  transient private Client client;
  @Transient
  @JsonIgnore
  transient private boolean recording = false;
  @Transient
  @JsonIgnore
  transient private long start = 0;

  public EventRecorder() {
    super();
  }

  public EventRecorder(WorldManager worldManager, Client client, String name) {
    this.setName(name);
    init(worldManager, client);
  }

  // CHECKME: this should probably be called from start()
  public void init(WorldManager worldManager, Client client) {
    this.client = client;

    this.setMapper(client.getMapper());
    this.setWorld(client.getWorld());
    this.setPosition(new Point(client.getPosition()));
    this.setSceneProperties(client.getSceneProperties());
    this.setMesh(client.getMesh());
    this.setActive(true);

    // record everything a client sends:
    if (this.recordClient) {
      client.addListener(this);
    }
    // scene records everything that a client sees:
    if (this.recordScene) {
      setScene(new Scene(worldManager, this));
    }
    // CHECKME: call scene.update() first?
  }

  public void start() {
    if (getScene() == null) {
      throw new IllegalStateException("Scene is null");
    }
    this.recording = true;
    this.start = System.currentTimeMillis();
  }

  public void stop() {
    if (getScene() == null) {
      throw new IllegalStateException("Scene is null");
    }
    this.recording = false;
    if (this.loop) {
      events.add(new PersistentEvent(System.currentTimeMillis() - start, "own"));
    }
  }

  @Override
  public void sendMessage(Object obj) {
    if (recording) {
      try {
        long delay = System.currentTimeMillis() - start;
        if (obj instanceof VREvent) {
          VREvent event = (VREvent) obj;
          if (event.getPayload() == null) {
            // ensure it can be persisted
            event.setPayload(getMapper().writeValueAsString(event.getChanges()));
          }
          if (event.getSource() == client) {
            // this only happens when recordClient == true
            log.debug("Recording own message " + delay + ":" + obj);
            events.add(new PersistentEvent(delay, "own", event, this));
          } else {
            // this only happens when recordScene == true
            log.debug("Recording space event " + delay + ":" + obj);
            events.add(new PersistentEvent(delay, "world", event, event.getSource()));
          }
        } else if (obj instanceof Command) {
          // this only happens when recordScene == true
          // scene sends Add/Remove commands to the client
          Command cmd = (Command) obj;
          log.debug("Recording scene update " + delay + ":" + obj);
          events.add(new PersistentEvent(delay, "scene", cmd));
        } else {
          log.error("Unsupported message type: " + obj);
        }
      } catch (Exception e) {
        log.error("Can't record message " + obj, e);
      }
    }
  }

  public void play() {
    log.debug("Playing " + events.size() + " events...");
    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    events.stream().filter((event) -> "own".equals(event.getType()))
        .forEach((event) -> executor.schedule(() -> this.playEvent(event), event.getDelay(), TimeUnit.MILLISECONDS));
    executor.shutdown();
  }

  private void playEvent(PersistentEvent event) {
    if (this.loop && event.restart()) {
      // last event optionally restarts the loop
      this.play();
    } else {
      try {
        if (event.getChanges() == null) {
          ObjectReader reader = getMapper().readerForUpdating(event.getSource());
          reader.readValue(event.getPayload());
        }
        this.notifyListeners(event.getEvent());
      } catch (Exception e) {
        log.error("Can't play event " + event, e);
      }
    }
  }

  /**
   * Play back to a client sends all recorded events back to a client.
   * 
   * @param viewer Client who's viewing the recording
   */
  public void play(Client viewer) {
    log.debug("Playing " + events.size() + " events to Client " + viewer);
    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    events
        .forEach((event) -> executor.schedule(() -> playEvent(event, viewer), event.getDelay(), TimeUnit.MILLISECONDS));
    executor.shutdown();
  }

  private void playEvent(PersistentEvent event, Client viewer) {
    log.debug("Playing " + event.getDelay());
    try {
      if (this.loop && event.restart()) {
        // last event optionally restarts the loop
        this.play(viewer);
      } else {
        viewer.sendMessage(event.getMessage());
      }
    } catch (Exception e) {
      log.error("Error playing event " + event.getDelay(), e);
    }
  }

  public Collection<PersistentEvent> getEvents() {
    return events;
  }

}
