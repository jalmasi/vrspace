package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

/**
 * Enter a world. By default this command is asynchronous, and sends Welcome
 * message back over websocket. When async is false, it responds with
 * ClientResponse containing Welcome message.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@RequiredArgsConstructor
@AllArgsConstructor
public class Enter implements Command {
  /** Name of the world to enter */
  @NonNull
  private String world;
  /** Optional token required to enter private worlds */
  private String token;
  /** Asynchronous command, defaults to true. */
  private boolean async = true;

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException {
    if (token != null) {
      client.setToken(this.world, token);
    }
    // CHECKME this could be turned into synchronous command
    Welcome welcome = manager.enter(client, this.world);
    if (async) {
      // CHECKME this triggers client-side welcomeListeners
      client.sendMessage(welcome);
      return null;
    }
    // CHECKME so we don't trigger welcomeListeners
    return new ClientResponse(welcome);
  }
}
