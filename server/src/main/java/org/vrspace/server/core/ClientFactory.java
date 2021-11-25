package org.vrspace.server.core;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.vrspace.server.obj.Client;

/**
 * Client factory interface, providing methods required to log in into the
 * server. Factory methods are passed client name if available, i.e. if client
 * HTTP session is authorised. All session HTTP headers are passed every method.
 * 
 * @author joe
 * @see WorldManager#login(org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator)
 *
 */
public interface ClientFactory {
  public static final String CLIENT_ATTRIBUTE = "local-user-name";

  /**
   * Find an authorised known client, called only if security principal is known.
   * 
   * @param principal  security principal of the client
   * @param db         database repository
   * @param headers    all HTTP headers
   * @param attributes session attributes copied from HttpSession
   * @return a client found in the database or elsewhere
   */
  public Client findClient(Principal principal, VRObjectRepository db, HttpHeaders headers,
      Map<String, Object> attributes);

  /**
   * Create a new guest client, called only if server configuration allows for
   * anonymous guest clients, and client name (security principal) is unknown.
   * Default implementation does not create a client.
   * 
   * @param headers    all HTTP headers
   * @param attributes session attributes copied from HttpSession
   * @return new Client instance, null by default
   */
  public default Client createGuestClient(HttpHeaders headers, Map<String, Object> attributes) {
    return null;
  }

  /**
   * Called if guest clients are not allowed, and user name (security principal)
   * is unknown. Implementation may yet return a client based on headers
   * available. Default implementation returns null.
   * 
   * @param headers    all HTTP headers
   * @param attributes session attributes copied from HttpSession
   * @return a Client determined by headers, null by default
   */
  public default Client handleUnknownClient(HttpHeaders headers, Map<String, Object> attributes) {
    return null;
  }

  /**
   * Identifies client attribute name, used as key to store client name in session
   * attributes. Default is "local-user-name".
   * 
   * @return
   */
  public default String clientAttribute() {
    return CLIENT_ATTRIBUTE;
  }
}
