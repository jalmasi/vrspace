package org.vrspace.server.dto;

import org.vrspace.server.core.SessionException;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Start another streaming session, for e.g. screen share
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
public class StreamingSession implements Command {
  /** start/stop */
  String action;

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException, SessionException {
    if ("start".equals(action)) {
      return new ClientResponse(manager.getStreamManager().addConnection(client));
    } else if ("stop".equals(action)) {
      manager.getStreamManager().closeConection(client);
    } else {
      throw new IllegalArgumentException("Invalid action: " + action);
    }
    return null;
  }

}
