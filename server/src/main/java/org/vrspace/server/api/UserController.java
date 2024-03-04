package org.vrspace.server.api;

import javax.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;

import com.nimbusds.oauth2.sdk.util.StringUtils;

import lombok.extern.slf4j.Slf4j;

/**
 * Basic user information. Users can't be created here yet, it's all automated
 * in Oauth2Controller for authenticated users, and WorldManager for guest
 * users.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(UserController.PATH)
public class UserController extends ApiBase {
  public static final String PATH = API_ROOT + "/user";
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private ClientFactory clientFactory;
  @Autowired
  private ServerConfig config;

  /**
   * Verifies that user name is available: if user is not logged in, that there's
   * no such user, or user's name in the database matches name in current session.
   * 
   * @param name    user name to verify
   * @param session http session, automatically provided
   * @return true if user can log in with given name
   */
  @GetMapping("/available")
  public boolean checkName(String name, HttpSession session) {
    if (StringUtils.isBlank(name)) {
      return config.isGuestAllowed();
    }
    Client client = db.getClientByName(name);
    String currentName = userName(session);
    boolean valid = client == null || (client.getName() != null && client.getName().equals(currentName));

    log.debug("Client name " + name + " available for " + currentName + ": " + valid);
    // TODO security - this method allows for user name enumeration
    // add some configurable delay here in case of invalid user name
    return valid;
  }

  /**
   * Check if the user is already authenticated
   * 
   * @param session http session, automatically provided
   * @return true if user is currently authenticated
   */
  @GetMapping("/authenticated")
  public boolean authenticated(HttpSession session) {
    return userName(session) != null;
  }

  /**
   * Returns current user name
   * 
   * @param session
   * @return authenticated user name, or null if user is not authenticated
   */
  @GetMapping("/name")
  public String userName(HttpSession session) {
    return currentUserName(session, clientFactory);
  }

  /**
   * Returns current user object
   * 
   * @param session
   * @return current user Client object, or null if user is not authenticated
   */
  @GetMapping("/object")
  public Client userObject(HttpSession session) {
    String currentName = currentUserName(session, clientFactory);
    if (currentName != null) {
      return db.getClientByName(currentName);
    }
    return null;
  }

}
