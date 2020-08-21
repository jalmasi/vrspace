package org.vrspace.server.dto;

import org.vrspace.server.WorldManager;
import org.vrspace.server.obj.Client;

public interface Command {

  ClientResponse execute(WorldManager world, Client client) throws Exception;

}
