package org.vrspace.server.core;

import java.util.HashSet;
import java.util.concurrent.LinkedBlockingQueue;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.VRObject;

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

  @Autowired
  VRObjectRepository db;

  private ThreadLocal<LinkedBlockingQueue<VRObject>> objects = ThreadLocal
      .withInitial(() -> new LinkedBlockingQueue<>());
  private ThreadLocal<LinkedBlockingQueue<VRObject>> deleted = ThreadLocal
      .withInitial(() -> new LinkedBlockingQueue<>());

  @Setter
  @Getter
  @Value("${org.vrspace.writeback.enabled:true}")
  private volatile boolean active = true;
  @Setter
  @Getter
  @Value("${org.vrspace.writeback.delay:1000}")
  private long delay = 1000;

  private volatile long totalWritten = 0;
  private volatile long lastFlush = 0;

  private void optionallyFlush() {
    VRObject first = objects.get().peek();
    if (first != null && lastFlush + delay < System.currentTimeMillis()) {
      flush(first);
    }
  }

  // CHECKME: public?
  public void flush(VRObject first) {
    Long time = System.currentTimeMillis();
    HashSet<VRObject> changes = new HashSet<>();
    objects.get().drainTo(changes);
    if (first != null) {
      changes.add(first);
    }
    while (!deleted.get().isEmpty()) {
      VRObject deletedOne = deleted.get().remove();
      changes.remove(deletedOne);
    }
    totalWritten += changes.size();
    lastFlush = System.currentTimeMillis();
    db.saveAll(changes);
    log.debug("Wrote " + changes.size() + " in " + (System.currentTimeMillis() - time) + " ms");
  }

  public int size() {
    return objects.get().size();
  }

  public long writes() {
    return totalWritten;
  }

  public void write(VRObject o) {
    if (o.getId() == null) {
      throw new IllegalArgumentException("New objects can't be written back, save them first to obtain id");
    }
    if (active) {
      objects.get().add(o);
      optionallyFlush();
    } else {
      db.save(o);
    }
  }

  public void delete(VRObject o) {
    if (active) {
      deleted.get().add(o);
    }
    db.delete(o);
    optionallyFlush();
  }

}
