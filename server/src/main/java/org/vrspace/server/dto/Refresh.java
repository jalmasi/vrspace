package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;

/**
 * FIXME: clear causes ConcurrentModificationException during scene removal
 * 
 * @author joe
 *
 */
@Data
public class Refresh implements Command {
  private boolean clear;

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    if (clear) {
      client.getScene().removeAll();
    } else {
      client.getScene().setDirty();
    }
    // WorldManager executes scene.update() after each command
    return null;
  }

}
