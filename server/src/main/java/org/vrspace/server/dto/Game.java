package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Data
@NoArgsConstructor
@Slf4j
public class Game implements Command {
  private Long id;
  private String action = "join";

  @Override
  public ClientResponse execute(WorldManager worldManager, Client client) throws Exception {
    org.vrspace.server.obj.Game game = worldManager.get(org.vrspace.server.obj.Game.class, id);
    if (game == null) {
      log.error("Client " + client + " wants to join non-existing game " + id);
    } else if ("join".equals(action)) {
      game.join(client);
    } else if ("join".equals(action)) {
      game.quit(client);
    } else if ("start".equals(action)) {
      game.start(client);
    } else if ("end".equals(action)) {
      game.end(client);
    }
    return null;
  }

}