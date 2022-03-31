package org.vrspace.server.obj;

import java.net.URI;
import java.util.List;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * BotLibre integration point, TODO
 * 
 * @author joe
 *
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class BotLibre extends Bot {

  @JsonIgnore
  @Transient
  private RestTemplate restTemplate = new RestTemplate();

  @Data
  @NoArgsConstructor
  public static class Response {
    private String message;
    private String conversation;
    private String emote;
    private String avatar;
    private String avatarType;
    private String avatarTalk;
    private String avatarTalkType;
    private String avatarBackground;
  }

  @Override
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
    log.debug(getResponse(null, "hello again"));

  }

  @Override
  public String getResponse(Client c, String query) {
    String ret = "";
    try {
      ResponseEntity<String> result = sendQuery(query);
      Response response = getMapper().readValue(result.getBody(), Response.class);
      ret = response.getMessage();
    } catch (Exception e) {
      log.error("Can't get response to: " + query, e);
    }
    return ret;
  }

  private ResponseEntity<String> sendQuery(String what) throws Exception {
    log.debug(this + " request: " + what);
    URI uri = new URI(getUrl());
    String body = "{\"application\":\"" + getParameter("application") + "\", \"instance\":\"" + getParameter("instance")
        + "\",\"message\":\"" + what + "\"}";
    RequestEntity<String> requestEntity = RequestEntity.post(uri).contentType(MediaType.APPLICATION_JSON).body(body);
    ResponseEntity<String> result = restTemplate.exchange(requestEntity, String.class);
    log.debug(this + " response: " + result.getBody());
    return result;
  }
}
