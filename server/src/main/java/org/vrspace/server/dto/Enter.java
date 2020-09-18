package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class Enter implements Command {
  private String world;

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException {
    Welcome welcome = manager.enter(client, this.world);
    client.sendMessage(welcome);
    return null;
  }
}
