package org.vrspace.server.dto;

import org.vrspace.server.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class Enter implements Command {
  private String world;

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException {
    World world = manager.getWorld(this.world);
    if (world == null) {
      throw new IllegalArgumentException("Unknown world: " + this.world);
    }
    Welcome welcome = manager.enter(client, world);
    client.sendMessage(welcome);
    return null;
  }
}
