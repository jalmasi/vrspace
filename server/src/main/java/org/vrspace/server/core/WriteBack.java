package org.vrspace.server.core;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

/**
 * Experimental thread-safe write-back component. Clients may send more events
 * than can be stored into the database. Typically, the most frequent events
 * originate from client movement. While movement events need to be propagated,
 * they doesn't need to be persisted each and every time, as long as client
 * coordinates are consistent overall. This component collects all changed
 * objects, and saves them after configurable delay, all in one one batch. Used
 * by WorldManager.
 * 
 * @author joe
 * @see WorldManager
 *
 */
@Component
@Slf4j
public class WriteBack {

  private VRObjectRepository db;

  @SuppressWarnings("static-access")
  private Set<VRObject> objects = new ConcurrentHashMap<VRObject, ID>().newKeySet();

  @Setter
  @Getter
  private volatile boolean active = true;
  @Setter
  @Getter
  private long delay = 1000;

  private volatile long totalRequests = 0;
  private volatile long totalWritten = 0;
  private volatile long lastFlush = 0;
  private volatile boolean writing = false;

  public WriteBack(VRObjectRepository db) {
    this.db = db;
  }

  private void optionallyFlush() {
    if (!objects.isEmpty() && lastFlush + delay < System.currentTimeMillis()) {
      flush();
    }
  }

  public void flush() {
    if (!active || writing) {
      return;
    }
    writing = true;
    long time = System.currentTimeMillis();
    totalWritten += objects.size();
    lastFlush = System.currentTimeMillis();
    try {
      // this still blocks the client thread
      db.saveAll(objects);
      long saveTime = System.currentTimeMillis() - time;
      log.debug("Wrote " + objects.size() + " in " + (saveTime) + " ms");
      if (saveTime > delay) {
        log.warn("Save time " + saveTime + " longer than delay " + delay + ", increasing");
        delay = saveTime + 1000;
      }
    } catch (Exception e) {
      active = false;
      log.error("Write error, writeback disabled", e);
    }
    objects.clear();
    writing = false;
  }

  public int size() {
    return objects.size();
  }

  public long writes() {
    return totalWritten;
  }

  public long writeRequests() {
    return totalRequests;
  }

  public void write(VRObject o) {
    if (o.getId() == null) {
      throw new IllegalArgumentException("New objects can't be written back, save them first to obtain id");
    }
    if (active) {
      totalRequests++;
      objects.add(o);
      optionallyFlush();
    } else {
      db.save(o);
    }
  }

  public void delete(VRObject o) {
    if (active) {
      objects.remove(o);
      flush();
    }
    db.delete(o);
  }

}
