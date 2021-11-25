package org.vrspace.server.api;

import javax.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping("/user")
public class UserController {
  @Autowired
  VRObjectRepository db;
  @Autowired
  ClientFactory clientFactory;

  /**
   * Verifies that user name is available: if user is not logged in, that there's
   * no such user, or user's name in the database matches name in current session.
   * 
   * @param name    user name to verify
   * @param session http session, automatically provide
   * @return true if user can log in with given name
   */
  @GetMapping("/available")
  public boolean checkName(String name, HttpSession session) {
    Client client = db.getClientByName(name);
    Object currentName = session.getAttribute(clientFactory.clientAttribute());
    boolean valid = client == null || (client.getName() != null && client.getName().equals(currentName));

    log.debug("Client name " + name + " available: " + (client == null));
    // TODO security - this method allows for user name enumeration
    // add some configurable delay here in case of invalid user name
    return valid;
  }
}
