package org.vrspace.server.dto;

import org.vrspace.server.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;

@Data
public class Refresh implements Command {

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    client.getScene().setDirty();
    client.getScene().update();
    return null;
  }

}
