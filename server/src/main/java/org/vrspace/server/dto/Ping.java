package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Some ISPs and/or hosting providers close inactive websockets after some time.
 * Ping is typically used to prevent this from happening.
 * 
 * @author Tero de la Rosa
 *
 */
@Data
@NoArgsConstructor
public class Ping implements Command {
  private static final String PONG = "Pong";

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException {
    return new ClientResponse(PONG);
  }
}
