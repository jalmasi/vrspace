package org.vrspace.server.dto;

import org.vrspace.server.World;
import org.vrspace.server.obj.Client;

public interface Command {

  ClientResponse execute(World world, Client client) throws Exception;

}
