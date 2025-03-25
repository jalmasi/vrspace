package org.vrspace.server.api;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.WebPushSubscription;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Keeps track of clients WebPush subscription data. User must be authorized and
 * connected to manage subscriptions. User can have multiple subscriptions,
 * assuming access from multiple devices. Subscribed users may get notifications
 * while offline, e.g. with new group messages.
 * 
 * @author joe
 *
 */
@ConditionalOnProperty("webpush.publicKey")
@RestController
@Slf4j
@RequestMapping(WebPushController.PATH)
public class WebPushController extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/webpush";

  @Value("${webpush.publicKey}")
  private String publicKey;
  @Autowired
  private VRObjectRepository db;

  /**
   * Subscribe to webpush: this notifies the server that the browser has created a
   * webpush subscription. Requires authorization.
   * 
   * @param info Subscription data.
   */
  @PostMapping("/subscribe")
  public void subscribe(@RequestBody WebPushSubscription info, HttpSession session) {
    log.debug("WebPush register: " + info);
    Client client = getAuthorisedClient(session, db);
    // CHECKME this fails for newly created clients that do not yet exist in the
    // database - client.getId() is null
    Optional<WebPushSubscription> existing = db.listSubscriptions(client.getId()).stream()
        .filter(sub -> sub.getEndpoint().equals(info.getEndpoint())).findAny();
    if (existing.isEmpty()) {
      info.setClient(client);
      db.save(info);
    } else {
      log.debug("Existing subscription: " + info);
    }
  }

  /**
   * Removes subscription information from the server, when browser unsubscribes.
   * Requires authorization.
   * 
   * @param info
   * @param session
   */
  @PostMapping("/unsubscribe")
  public void unsubscribe(@RequestBody WebPushSubscription info, HttpSession session) {
    log.debug("WebPush unsubscribe: " + info);
    Client client = getAuthorisedClient(session, db);
    db.listSubscriptions(client.getId()).forEach(sub -> {
      if (sub.getEndpoint().equals(info.getEndpoint())) {
        db.delete(sub);
      }
    });
  }

  /**
   * Returns public VAPID key required to create WebPush subscription.
   * 
   * @return Base64 encoded key
   */
  @GetMapping("/publicKey")
  public String getKey() {
    return this.publicKey;
  }

}
