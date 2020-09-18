package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

public interface Command {

  ClientResponse execute(WorldManager worldManager, Client client) throws Exception;

}
