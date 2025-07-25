package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.User;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.oauth2.sdk.util.StringUtils;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.servlet.http.HttpSession;
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
@RequestMapping(Users.PATH)
public class Users extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/user";
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private ServerConfig config;
  @Autowired
  @Qualifier("restPrivateMapper")
  protected ObjectMapper jackson;

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
    return isAuthenticated(session);
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
   * @return current user object, or null if user is not authenticated, or not
   *         instance of User
   */
  @GetMapping("/object")
  @ApiResponses(value = { @ApiResponse(responseCode = "200", description = "Ok", content = {
      @Content(mediaType = "application/json", schema = @Schema(implementation = User.class)) }) })
  // public @ResponseBody User userObject(HttpSession session) {
  public ResponseEntity<String> userObject(HttpSession session) {
    String currentName = currentUserName(session, clientFactory);
    try {
      if (currentName != null) {
        Client client = db.getClientByName(currentName);
        if (client instanceof User) {
          ((User) client).setOauth2provider((String) session.getAttribute(ClientFactory.OAUTH2PROVIDER_ID_ATTRIBUTE));
          String ret = jackson.writeValueAsString((User) client);
          return ResponseEntity.ok(ret);
        }
      }
    } catch (Exception e) {
      log.error("User object retrieval failure", e);
    }
    return null;
  }

  /**
   * Find user by name. Only available to users currently connected.
   * 
   * @param name    User name, case sensitive, exact match
   * @param session
   * @return Client object
   */
  @GetMapping("/find")
  public @ResponseBody ResponseEntity<Client> find(String name, HttpSession session) {
    // stop if user is not connected:
    findClient(session);
    Client client = db.getClientByName(name);
    if (client == null) {
      return new ResponseEntity<Client>(HttpStatusCode.valueOf(404));
    }
    return new ResponseEntity<Client>(client, HttpStatusCode.valueOf(200));
  }

}
