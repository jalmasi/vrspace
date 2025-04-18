package org.vrspace.server.api;

import org.vrspace.server.core.ClientFactory;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Base class for API controllers
 * 
 * @author joe
 *
 */
@Slf4j
public abstract class ApiBase {
  public static final String API_ROOT = "/vrspace/api";

  public static String currentUserName(HttpSession session, ClientFactory clientFactory) {
    log.debug(clientFactory.clientNameAttribute() + "=" + session.getAttribute(clientFactory.clientNameAttribute())
        + " session: " + session);
    return (String) session.getAttribute(clientFactory.clientNameAttribute());
  }

  public static boolean isAuthenticated(HttpSession session, ClientFactory clientFactory) {
    return currentUserName(session, clientFactory) != null;
  }

}
