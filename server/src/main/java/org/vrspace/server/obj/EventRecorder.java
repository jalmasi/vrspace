package org.vrspace.server.obj;

import java.util.Collection;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Recording;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;

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
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class EventRecorder extends User {
  private boolean recordClient = true;
  private boolean recordScene = true;
  private boolean loop = true;
  private Long length;
  @JsonIgnore
  private Collection<PersistentEvent> events = new ConcurrentLinkedQueue<PersistentEvent>();
  @JsonIgnore
  @Transient
  transient private Client client;
  @Transient
  @JsonIgnore
  transient private boolean recording = false;
  @Transient
  @JsonIgnore
  transient private long start = 0;
  @Transient
  @JsonIgnore
  transient volatile private boolean playing = false;
  @Transient
  @JsonIgnore
  ScheduledExecutorService restart;

  public EventRecorder() {
    super();
    this.setActive(true);
  }

  public EventRecorder(WorldManager worldManager, Client client, String name) {
    this.setName(name);
    this.setWorldId(client.getWorldId());
    this.setPosition(new Point(client.getPosition()));
    this.setSceneProperties(client.getSceneProperties());
    this.setMesh(client.getMesh());
    this.setActive(true);
  }

  // CHECKME: this should probably be called from start()
  public void init(WorldManager worldManager, Client client) {
    this.client = client;

    this.setMapper(client.getMapper());
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
    if (this.recordScene && getScene() == null) {
      throw new IllegalStateException("Scene is null");
    }
    this.recording = true;
    this.setActive(false); // prevent from popping up in the scene before finished
    this.start = System.currentTimeMillis();
  }

  public void stop() {
    if (this.recordScene && getScene() == null) {
      throw new IllegalStateException("Scene is null");
    }
    this.recording = false;
    this.setActive(true);
    this.length = System.currentTimeMillis() - this.start;
  }

  @Override
  public void processEvent(VREvent event) {
    sendMessage(event);
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
            log.debug(this.getName() + " Recording own message " + delay + ":" + obj);
            events.add(new PersistentEvent(delay, "own", event, this));
          } else {
            // this only happens when recordScene == true
            log.debug(this.getName() + " Recording space event " + delay + ":" + obj);
            events.add(new PersistentEvent(delay, "world", event, event.getSource()));
          }
        } else if (obj instanceof Command) {
          // this only happens when recordScene == true
          // scene sends Add/Remove commands to the client
          Command cmd = (Command) obj;
          log.debug(this.getName() + " Recording scene update " + delay + ":" + obj);
          events.add(new PersistentEvent(delay, "scene", cmd));
        } else {
          log.error(this.getName() + " Unsupported message type: " + obj);
        }
      } catch (Exception e) {
        log.error(this.getName() + " Can't record message " + obj, e);
      }
    }
  }

  /**
   * Play recorded client events as own events, optionally restart the loop when
   * finished.
   */
  public void play() {
    if (this.events.size() > 0 && this.getListeners().size() > 0) {
      log.debug(this.getName() + " Playing " + events.size() + " events...");
      this.playing = true;
      ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
      events.stream().filter((event) -> "own".equals(event.getType()))
          .forEach((event) -> executor.schedule(() -> this.playEvent(event), event.getDelay(), TimeUnit.MILLISECONDS));
      executor.shutdown();
      if (this.length != null) {
        restart = Executors.newSingleThreadScheduledExecutor();
        if (this.loop) {
          restart.schedule(() -> this.play(), this.length, TimeUnit.MILLISECONDS);
        } else {
          restart.schedule(() -> this.playing = false, this.length, TimeUnit.MILLISECONDS);
        }
        restart.shutdown();
      }
    } else {
      log.debug(this.getName() + " Noone is listening, shutting down");
      this.playing = false;
    }
  }

  private void playEvent(PersistentEvent event) {
    try {
      // neo4j can't store VREvent.changes Map<String,Object>, so we need to recreate
      // it from stored String payload
      if (event.getChanges() == null) {
        VREvent changed = getMapper().readValue(event.getPayload(), VREvent.class);
        event.setChanges(changed.getChanges());
      }
      this.notifyListeners(event.getEvent());
    } catch (Exception e) {
      log.error(this.getName() + " Can't play event " + event, e);
    }
  }

  /**
   * Play back to a client sends all recorded events back to a client, optionally
   * restarts the loop when finished.
   * 
   * @param viewer Client who's viewing the recording
   */
  public void play(Client viewer) {
    log.debug(this.getName() + " Playing " + events.size() + " events to Client " + viewer);
    ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
    events
        .forEach((event) -> executor.schedule(() -> playEvent(event, viewer), event.getDelay(), TimeUnit.MILLISECONDS));
    executor.shutdown();
    if (this.loop && this.length != null) {
      restart = Executors.newSingleThreadScheduledExecutor();
      restart.schedule(() -> this.play(viewer), this.length, TimeUnit.MILLISECONDS);
      restart.shutdown();
    }
  }

  private void playEvent(PersistentEvent event, Client viewer) {
    try {
      viewer.sendMessage(event.getMessage());
    } catch (Exception e) {
      log.error("Error playing event " + event, e);
    }
  }

  @Override
  public void addListener(VRObject obj) {
    if (this.getListeners() == null || this.getListeners().size() == 0) {
      super.addListener(obj);
      // mapper can be null when persistent recorder is loaded from the database
      if (this.getMapper() == null) {
        this.setMapper(((Client) obj).getMapper());
      }
      log.debug(getName() + " First listener, loop: " + this.loop + " playing: " + this.playing + " recording: "
          + this.recording);
      if (this.loop && !this.playing && !this.recording) {
        this.play();
      }
    } else {
      super.addListener(obj);
    }
  }

  public Collection<PersistentEvent> getEvents() {
    return events;
  }

}
