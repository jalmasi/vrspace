package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;

@Data
public class Refresh implements Command {
  private boolean clear;

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    if (clear) {
      client.getScene().reload();
      client.getScene().update();
    } else {
      client.getScene().setDirty();
      client.getScene().update();
    }
    return null;
  }

}
