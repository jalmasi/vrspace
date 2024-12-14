package org.vrspace.server.core;

import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;

/**
 * A session listener gets all events from all sessions, and can forward or
 * store them for e.g. analytics, observability etc. Multiple session listeners
 * can be configured, and SessionManager will happily forward each event to each
 * of them, so they have to be very performant, or they could bring the server
 * to crawl.
 * 
 * @author joe
 *
 */
public interface SessionListener {
  /** Successfully processed client request */
  public void success(ClientRequest request);

  /** Event generated on the server (e.g. by a bot) */
  public void event(VREvent event);

  /** Failed client request */
  public void failure(Client client, String message, Throwable error);

  /** A client has logged in */
  public void login(Client client);

  /** A client has logged out */
  public void logout(Client client);
}
