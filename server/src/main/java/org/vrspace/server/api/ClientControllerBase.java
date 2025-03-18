package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import jakarta.servlet.http.HttpSession;

public class ClientControllerBase extends ApiBase {
  @Autowired
  WorldManager worldManager;
  @Autowired
  ClientFactory clientFactory;

  protected Client findClient(HttpSession session) {
    Long clientId = (Long) session.getAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE);
    Client client = worldManager.getClient(clientId);

    if (client == null) {
      throw new SecurityException("The client is not connected");
    }

    return client;
  }

  protected boolean isAuthenticated(HttpSession session) {
    return isAuthenticated(session, clientFactory);
  }

  protected Client getAuthorisedClient(HttpSession session) {
    if (!isAuthenticated(session)) {
      throw new SecurityException("Anonymous user");
    }
    Client client = findClient(session);
    if (client.isTemporary()) {
      throw new SecurityException("Temporary user");
    }
    return client;
  }
}
