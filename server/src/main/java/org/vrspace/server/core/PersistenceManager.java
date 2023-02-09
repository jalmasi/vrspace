package org.vrspace.server.core;

import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Entity;

public class PersistenceManager<T extends Entity> {

  public void persist(VREvent event) {
    event.getClient().getWriteBack().write(event.getSource());
  }

  public void postLoad(T o) {

  }
}
