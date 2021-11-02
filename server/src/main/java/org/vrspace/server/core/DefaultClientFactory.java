package org.vrspace.server.core;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.vrspace.server.obj.Client;

@Component
/**
 * Default client factory allows for anonymous guest login.
 * 
 * @author joe
 *
 */
public class DefaultClientFactory implements ClientFactory {
  /**
   * Returns new client.
   */
  public Client createGuestClient(HttpHeaders headers) {
    return new Client();
  }

}
