package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import jakarta.servlet.http.HttpSession;

public class ClientControllerBase extends ApiBase {
  @Autowired
  WorldManager worldManager;
  @Autowired
  ClientFactory clientFactory;

  protected Client findClient(HttpSession session) {
    return findClient(session, null);
  }

  protected Client findClient(HttpSession session, VRObjectRepository db) {
    Long clientId = (Long) session.getAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE);
    Client client = worldManager.getClient(clientId);

    if (client == null) {
      if (db == null) {
        throw new SecurityException("The client is not connected");
      } else {
        client = db.getClient(clientId);
      }
    }

    return client;
  }

  protected boolean isAuthenticated(HttpSession session) {
    return isAuthenticated(session, clientFactory);
  }

  protected Client getAuthorisedClient(HttpSession session) {
    return getAuthorisedClient(session, null);
  }

  protected Client getAuthorisedClient(HttpSession session, VRObjectRepository db) {
    if (!isAuthenticated(session)) {
      throw new SecurityException("Anonymous user");
    }
    Client client = findClient(session, db);
    if (client != null && client.isTemporary()) {
      throw new SecurityException("Temporary user");
    }
    return client;
  }
}
