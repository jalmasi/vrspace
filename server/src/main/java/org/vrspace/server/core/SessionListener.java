package org.vrspace.server.core;

import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.obj.Client;

public interface SessionListener {
  public default void success(ClientRequest request) {
  }

  public default void failure(Client client, String message, Throwable error) {
  }

  public default void login(Client client) {
  }

  public default void logout(Client client) {
  }
}
