package org.vrspace.server.core;

import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;

/**
 * A session listener gets all events from all sessions, and can forward or
 * store them for e.g. analytics, observability etc. There can be only one
 * session listener, for performance reasons.
 */
public interface SessionListener {
  /** Successfully processed client request */
  public default void success(ClientRequest request) {
  }

  /** Event generated on the server (e.g. by a bot) */
  public default void event(VREvent event) {
  }

  /** Failed client request */
  public default void failure(Client client, String message, Throwable error) {
  }

  /** A client has logged in */
  public default void login(Client client) {
  }

  /** A client has logged out */
  public default void logout(Client client) {
  }
}
