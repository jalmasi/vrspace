package org.vrspace.server.dto;

import org.vrspace.server.core.SessionException;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Session flow control. Currently only starts the session, and is very first
 * command issued, just after connection is established and client properties
 * are set.
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
    manager.startSession(client);
    return null;
  }

}
