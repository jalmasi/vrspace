package org.vrspace.server.dto;

import org.vrspace.server.core.SessionException;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;

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
