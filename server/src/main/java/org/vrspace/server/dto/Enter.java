package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Enter a world.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Enter implements Command {
  /** Name of the world to enter */
  private String world;

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException {
    Welcome welcome = manager.enter(client, this.world);
    client.sendMessage(welcome);
    return null;
  }
}
