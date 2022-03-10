package org.vrspace.server.obj;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.annotation.Transient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * A bot is a Client that has no session. It does have own scene, and observes
 * all events in the scene.
 * 
 * @author joe
 *
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
public class Bot extends Client {
  @JsonIgnore
  private String url;
  @JsonIgnore
  private String method = "GET";

  @JsonIgnore
  @Transient
  private RestTemplate restTemplate = new RestTemplate();

  @Data
  @NoArgsConstructor
  public static class Response {
    private String response;
  }

  public void selfTest() throws Exception {
    ResponseEntity<String> result = sendQuery("hello world");
    if (result.getStatusCodeValue() == 200) {
      String response = result.getBody();
      log.debug(this + " initial response: " + response);
    } else {
      throw new IllegalStateException("Invalid response code: " + result.getStatusCodeValue());
    }
    List<String> contentType = result.getHeaders().get("Content-Type");
    if (contentType.size() == 0) {
      throw new IllegalStateException("Invalid response - no content type");
    }
    if (contentType.size() == 1) {
      String cType = contentType.get(0);
      log.debug("Response content type: " + cType);
      if (!"application/json".equals(cType)) {
        throw new IllegalStateException("Invalid response content type: " + contentType);
      }
    } else {
      throw new IllegalStateException("Invalid response content type - size " + contentType.size() + " " + contentType);
    }
    log.debug(getResponse("hello again"));
  }

  public String getResponse(String what) {
    String ret = "";
    try {
      ResponseEntity<String> result = sendQuery("hello world");
      Response response = getMapper().readValue(result.getBody(), Response.class);
      ret = response.getResponse();
    } catch (Exception e) {
      log.error("Can't get response to: " + what, e);
    }
    return ret;
  }

  public ResponseEntity<String> sendQuery(String what) throws Exception {
    log.debug(this + " request: " + what);
    String encoded = URLEncoder.encode(what, StandardCharsets.UTF_8.toString());
    URI uri = new URI(url + encoded);
    ResponseEntity<String> result = restTemplate.getForEntity(uri, String.class);
    log.debug(this + " response: " + result.getBody());
    return result;
  }

  private void write(String what) {
    VREvent event = new VREvent(this);
    Map<String, Object> changes = new HashMap<>();
    changes.put("wrote", what);
    event.setChanges(changes);
    this.notifyListeners(event);
  }

  @Override
  public void processEvent(VREvent event) {
    log.debug(this + " received event: " + event);
    if (!event.getSource().isActive()) {
      // stop listening to inactive objects (disconnected clients)
      event.getSource().removeListener(this);
    } else if (event.getChanges().containsKey("wrote")) {
      String what = (String) event.getChanges().get("wrote");
      String response = getResponse(what);
      write(response);
    }
  }

  @Override
  public void sendMessage(Object o) {
    log.debug(this + " received message:" + o);
    // TODO: process Add/Remove commands
  }

  @Override
  public String toString() {
    return "Bot " + getId();
  }
}
