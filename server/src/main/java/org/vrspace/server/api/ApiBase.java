package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import jakarta.servlet.http.HttpSession;

/**
 * Base class for API controllers
 * 
 * @author joe
 *
 */
public abstract class ApiBase {
  public static final String API_ROOT = "/vrspace/api";

  @Autowired
  WorldManager worldManager;

  public static String currentUserName(HttpSession session, ClientFactory clientFactory) {
    return (String) session.getAttribute(clientFactory.clientNameAttribute());
  }

  protected Client findClient(HttpSession session) {
    Long clientId = (Long) session.getAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE);
    Client client = worldManager.getClient(clientId);

    if (client == null) {
      throw new SecurityException("The client is not connected");
    }

    return client;
  }

}
