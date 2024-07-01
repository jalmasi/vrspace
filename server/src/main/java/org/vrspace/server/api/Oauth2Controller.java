package org.vrspace.server.api;

import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ResolvableType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.web.savedrequest.DefaultSavedRequest;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.User;

import lombok.extern.slf4j.Slf4j;

/**
 * Oauth2 login is completely handled by spring security, this is just callback
 * once it's all done. Client's identity is something like joe:facebook, but
 * hashed. Login name must match the stored identity. After login, user's Client
 * object is stored in HttpSession, under key specified by
 * clientFactory.clientAttribute() (local-user-name by default).
 * 
 * @author joe
 *
 */
@RestController
@ConditionalOnProperty("org.vrspace.oauth2.enabled")
@Slf4j
@RequestMapping(Oauth2Controller.PATH)
public class Oauth2Controller extends ApiBase {
  public static final String PATH = API_ROOT + "/oauth2";
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private ClientFactory clientFactory;
  private ClientRegistrationRepository clientRegistrationRepository;

  public Oauth2Controller(@Autowired ClientRegistrationRepository clientRegistrationRepository) {
    this.clientRegistrationRepository = clientRegistrationRepository;
  }

  /**
   * List of OAuth2 registered authentication providers.
   * 
   * @return key-value pair of id and name, as declared in application.properties
   */
  @SuppressWarnings("unchecked")
  @GetMapping("/providers")
  public Map<String, String> providers() {
    Iterable<ClientRegistration> clientRegistrations = null;
    ResolvableType type = ResolvableType.forInstance(clientRegistrationRepository).as(Iterable.class);
    if (type != ResolvableType.NONE && ClientRegistration.class.isAssignableFrom(type.resolveGenerics()[0])) {
      clientRegistrations = (Iterable<ClientRegistration>) clientRegistrationRepository;
    }
    Map<String, String> oauth2AuthenticationUrls = new HashMap<>();

    clientRegistrations.forEach(
        registration -> oauth2AuthenticationUrls.put(registration.getRegistrationId(), registration.getClientName()));
    return oauth2AuthenticationUrls;

  }

  /**
   * First step in Oauth2 Authentication is to obtain valid authentication
   * provider id. This is never called directly though, the browser is redirected
   * here from the login page. Obtains the provider id from the original request
   * and sends browser redirect.
   */
  @GetMapping("/provider")
  public ResponseEntity<String> setProvider(HttpSession session, HttpServletRequest request) {
    String location = "/login"; // default spring boot login page - disabled in web security config TODO
    DefaultSavedRequest original = (DefaultSavedRequest) session.getAttribute("SPRING_SECURITY_SAVED_REQUEST");
    String[] providers = original.getParameterMap().get("provider");
    if (providers != null && providers.length > 0) {
      location = PATH + "/authorization/" + providers[0];
    }
    return ResponseEntity.status(HttpStatus.FOUND).header("Location", location).body("Redirecting to " + location);
  }

  /**
   * This endpoint requires both user name and authentication provider id (fb,
   * github, google... as defined in app properties file). The framework then
   * performs authentication through a series of on-site and off-site redirects.
   * Only after successful Oauth2 authentication with external provider, this
   * method fetches or creates the Client object, and redirect back to the
   * referring page. Client object is stored in HttpSession, under key specified
   * by clientFactory.clientAttribute().
   * 
   * @param name     Login name of the user, local
   * @param provider Oauth2 authentication provider id , as registered in
   *                 properties file (e.g. github, facebook, google)
   * @param avatar   Optional avatar URI, used only when creating a new user
   */
  @GetMapping("/login")
  public ResponseEntity<String> login(String name, String provider, String avatar, HttpSession session,
      HttpServletRequest request) {
    String referrer = request.getHeader(HttpHeaders.REFERER);
    log.info("Referer: " + referrer);

    // at this point client is already authenticated
    if (ObjectUtils.isEmpty(name)) {
      throw new ApiException("Argument required: name");
    }
    log.debug("oauth login as:" + name);
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    String identity = identity((OAuth2AuthenticationToken) authentication);

    User client = db.getClientByName(name, User.class);
    if (client != null) {
      if (client.getIdentity() != null && client.getIdentity().equals(identity)) {
        log.debug("Welcome back: " + name);
      } else {
        throw new ApiException("Someone else uses this name: " + name);
      }
    } else {
      log.debug("Welcome new user: " + name);
      client = new User(name);
      client.setMesh(avatar);
      client.setIdentity(identity);
      client = db.save(client);
    }
    // CHECKME do we need to return anything?
    session.setAttribute(clientFactory.clientNameAttribute(), name);
    return ResponseEntity.status(HttpStatus.FOUND).header("Location", referrer).body("Redirecting to " + referrer);
  }

  // CHECKME some kind of universal identity
  private String identity(OAuth2AuthenticationToken token) {
    String authority = token.getAuthorizedClientRegistrationId();
    String realName = token.getPrincipal().getAttribute("name");
    // hash the name - we don't want any private data stored anywhere
    String hashedName = DigestUtils.sha256Hex(realName);
    return authority + ":" + hashedName;
  }

  // CHECKME unused?
  @GetMapping("/callback")
  public void callback(String code, String state, HttpServletRequest request) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

    OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
    log.debug("oauth callback: code=" + code + " " + oauthToken);
  }

}
