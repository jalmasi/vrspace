package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;

/**
 * Command to enforce Scene update.
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
      client.getScene().loadPermanents();
    } else {
      client.getScene().setDirty();
    }
    // WorldManager does NOT execute scene.update() after each command
    client.getScene().update();
    return null;
  }

}
