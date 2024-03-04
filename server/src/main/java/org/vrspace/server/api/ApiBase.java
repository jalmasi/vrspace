package org.vrspace.server.api;

import javax.servlet.http.HttpSession;

import org.vrspace.server.core.ClientFactory;

/**
 * Base class for API controllers
 * 
 * @author joe
 *
 */
public abstract class ApiBase {
  public static final String API_ROOT = "/vrspace/api";

  public static String currentUserName(HttpSession session, ClientFactory clientFactory) {
    return (String) session.getAttribute(clientFactory.clientAttribute());
  }

}
