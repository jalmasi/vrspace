package org.vrspace.server.dto;

import org.vrspace.server.core.SessionException;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Session flow control. Currently only starts the session, and is very first
 * command issued, just after connection is established and client properties
 * are set. This is synchronous operation, as it builds Client's Scene. Scene
 * content is delivered asynchronously, as an Add command. Returns current
 * number of objects in the scene, wrapped up in ClientResponse.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
public class Session implements Command {
  String action; // optional, TODO start/stop/pause/resume

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException, SessionException {
    return new ClientResponse(manager.startSession(client));
  }

}
