package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

/**
 * A command issued by a client. A client can issue only one command at the time
 * - consequence of command not having any identifiers.
 * 
 * @author joe
 *
 */
public interface Command {

  ClientResponse execute(WorldManager worldManager, Client client) throws Exception;

}
