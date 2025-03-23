package org.vrspace.server.api;

import java.util.Optional;

import org.apache.http.HttpResponse;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.dto.WebPushMessage;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.WebPushSubscription;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

@ConditionalOnProperty("webpush.publicKey")
@RestController
@Slf4j
@RequestMapping(WebPushController.PATH)
public class WebPushController extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/webpush";

  @Value("${webpush.publicKey}")
  private String publicKey;
  @Autowired
  private PushService pushService;
  @Autowired
  private ObjectMapper objectMapper;
  @Autowired
  private VRObjectRepository db;

  @PostMapping("/subscribe")
  public void subscribe(@RequestBody WebPushSubscription info, HttpSession session) {
    log.debug("WebPush register: " + info);
    Client client = getAuthorisedClient(session, db);
    // FIXME this fails for newly created clients that do not yet exist in the
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

  @GetMapping("/publicKey")
  public String getKey() {
    return this.publicKey;
  }

  // TODO we never notify all, this is an example
  @PostMapping("/notify-all")
  public void notifyAll(@RequestBody WebPushMessage message) {
    db.findAll().stream().filter(entity -> WebPushSubscription.class.isInstance(entity)).forEach(entity -> {
      WebPushSubscription subscription = (WebPushSubscription) entity;
      try {
        Notification notification = new Notification(subscription.getEndpoint(), subscription.getKey(),
            subscription.getAuth(), objectMapper.writeValueAsBytes(message));

        HttpResponse res = pushService.send(notification);
        log.debug("Notification sent:" + message + " to " + subscription.getEndpoint() + " result: " + res + " "
            + EntityUtils.toString(res.getEntity(), "UTF-8"));
        if (res.getStatusLine().getStatusCode() != 201) {
          log.error("Push notification failed");
        }
      } catch (Exception e) {
        log.error("Push notification failed", e);
      }
    });
  }
}
