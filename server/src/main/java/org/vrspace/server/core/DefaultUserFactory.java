package org.vrspace.server.core;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.User;

@Component
/**
 * Default client factory allows for anonymous guest login, and Oauth2
 * authenticated clients.
 * 
 * @author joe
 *
 */
public class DefaultUserFactory implements ClientFactory<User> {
  /**
   * Returns new client.
   */
  @SuppressWarnings("unchecked")
  @Override
  public User createGuestClient(HttpHeaders headers, Map<String, Object> attributes) {
    User ret = new User();
    ret.setGuest(true);
    return ret;
  }

  /**
   * Returns client existing in the database, identified by "local-user-name"
   * attribute value.
   */
  @Override
  public User findClient(Principal principal, VRObjectRepository db, HttpHeaders headers,
      Map<String, Object> attributes) {
    Object name = attributes.get(clientAttribute());
    if (name != null && name instanceof String) {
      return db.getClientByName((String) name, User.class);
    }
    throw new SecurityException("Unknown client name: " + name);
  }

}
