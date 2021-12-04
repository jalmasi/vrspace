package org.vrspace.server.core;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.Client;

@Component
/**
 * Default client factory allows for anonymous guest login, and Oauth2
 * authenticated clients.
 * 
 * @author joe
 *
 */
public class DefaultClientFactory implements ClientFactory {
  /**
   * Returns new client.
   */
  @Override
  public Client createGuestClient(HttpHeaders headers, Map<String, Object> attributes) {
    return new Client();
  }

  /**
   * Returns client existing in the database, identified by "local-user-name"
   * attribute value.
   */
  @Override
  public Client findClient(Principal principal, VRObjectRepository db, HttpHeaders headers,
      Map<String, Object> attributes) {
    Object name = attributes.get(clientAttribute());
    if (name != null && name instanceof String) {
      return db.getClientByName((String) name);
    }
    throw new SecurityException("Unknown client name: " + name);
  }

}
