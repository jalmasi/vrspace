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
  public <T extends Client> T createGuestClient(Class<T> clientClass, HttpHeaders headers,
      Map<String, Object> attributes) {
    try {
      T ret = clientClass.getDeclaredConstructor().newInstance();
      ret.setGuest(true);
      return ret;
    } catch (Exception e) {
      throw new RuntimeException("Failed to create client of class " + clientClass);
    }
  }

  /**
   * Returns client existing in the database, identified by "local-user-name"
   * attribute value.
   */
  @Override
  public <T extends Client> T findClient(Class<T> clientClass, Principal principal, VRObjectRepository db,
      HttpHeaders headers, Map<String, Object> attributes) {
    Object name = attributes.get(clientNameAttribute());
    if (name != null && name instanceof String) {
      return db.getClientByName((String) name, clientClass);
    }
    throw new SecurityException("Unknown client name: " + name);
  }

}
