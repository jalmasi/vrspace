package org.vrspace.server.core;

import java.util.HashSet;
import java.util.concurrent.LinkedBlockingQueue;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.VRObject;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

/**
 * Experimental write-back thread. Clients may send more events that can be
 * stored into the database. This component collects all changed objects, and
 * saves them as soon as they can be written, all in one one batch.
 * 
 * @author joe
 *
 */
@Component
@Slf4j
public class WriteBack implements Runnable {

  @Autowired
  VRObjectRepository db;

  private LinkedBlockingQueue<VRObject> objects = new LinkedBlockingQueue<>();
  private LinkedBlockingQueue<VRObject> deleted = new LinkedBlockingQueue<>();

  @Setter
  @Getter
  @Value("${org.vrspace.writeback.enabled:true}")
  private volatile boolean active = true;

  private volatile long totalWritten = 0;

  @PostConstruct
  public void init() {
    new Thread(this, "WriteBack").start();
    log.info("Writeback running");
  }

  public void run() {
    try {
      while (active) {
        VRObject first = objects.take(); // blocks while empty
        Long time = System.currentTimeMillis();
        HashSet<VRObject> changes = new HashSet<>();
        objects.drainTo(changes);
        changes.add(first);
        while (!deleted.isEmpty()) {
          VRObject deletedOne = deleted.remove();
          changes.remove(deletedOne);
        }
        totalWritten += changes.size();
        db.saveAll(changes);
        log.debug("Wrote " + changes.size() + " in " + (System.currentTimeMillis() - time) + " ms");
      }
    } catch (InterruptedException e) {
      log.info("Interrupted, shutting down");
      active = false;
    } catch (Exception e) {
      log.error("Exception in write back, disabling", e);
      active = false;
    }
  }

  public int size() {
    return objects.size();
  }

  public long writes() {
    return totalWritten;
  }

  public void write(VRObject o) {
    if (o.getId() == null) {
      throw new IllegalArgumentException("New objects can't be written back, save them first to obtain id");
    }
    if (active) {
      objects.add(o);
    } else {
      db.save(o);
    }
  }

  public void delete(VRObject o) {
    if (active) {
      deleted.add(o);
    }
    db.delete(o);
  }

  @PreDestroy
  public void cleanup() {
    log.info("Writeback stopping");
  }

}
