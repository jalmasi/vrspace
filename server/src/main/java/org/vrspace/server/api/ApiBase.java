package org.vrspace.server.api;

import org.vrspace.server.core.ClientFactory;

import jakarta.servlet.http.HttpSession;

/**
 * Base class for API controllers
 * 
 * @author joe
 *
 */
public abstract class ApiBase {
  public static final String API_ROOT = "/vrspace/api";

  public static String currentUserName(HttpSession session, ClientFactory clientFactory) {
    return (String) session.getAttribute(clientFactory.clientNameAttribute());
  }

}
