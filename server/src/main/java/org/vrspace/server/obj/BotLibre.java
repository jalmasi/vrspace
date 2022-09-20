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
 * BotLibre integration point. Forwards user query to configured url, sets
 * application and service to configured values. Keeps track of conversation id.
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
  public static class Query {
    /** user id at botlibre.com/biz/local */
    private String application;
    /** bot instance */
    private String instance;
    /** conversation id, initially empty, returned with each bots answer */
    private String conversation;
    private String message;
    /**
     * emotion to tag the message with. This is one of LOVE, LIKE, DISLIKE, HATE,
     * RAGE, ANGER, CALM, SERENE, ECSTATIC, HAPPY, SAD, CRYING, PANIC, AFRAID,
     * CONFIDENT, COURAGEOUS, SURPRISE, BORED, LAUGHTER, SERIOUS.
     */
    private String emote;
    /**
     * boolean that defines the chat message is a correction to the bot's last
     * answer.
     */
    private boolean correction;
    /*
     * boolean that defines the bot's last answer as offensive. The message will be
     * flagged for the bot's administrator to review.
     */
    private boolean offensive;
    /* boolean that defines the end of the conversation. */
    private boolean disconnect;
    /* boolean that indicates the question should be included in the response. */
    private boolean includeQuestion;
  }

  @Data
  @NoArgsConstructor
  public static class Response {
    private String message;
    private String conversation;
    /** Explained in query class. Default emote in response seems to be NONE */
    private String emote;
    private String avatar;
    private String avatarType;
    private String avatarTalk;
    private String avatarTalkType;
    private String avatarBackground;
  }

  @Override
  public void selfTest() throws Exception {
    ResponseEntity<String> result = sendQuery(new Client(), "hello world");
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
    log.debug(getResponse(new Client(), "hello again"));

  }

  @Override
  public String getResponse(Client client, String message) {
    String ret = "";
    try {
      ResponseEntity<String> result = sendQuery(client, message);
      Response response = getMapper().readValue(result.getBody(), Response.class);
      ret = response.getMessage();
      String conversationId = response.getConversation();
      client.setToken(serviceId(), conversationId);
    } catch (Exception e) {
      log.error("Can't get response to: " + message, e);
    }
    return ret;
  }

  private ResponseEntity<String> sendQuery(Client client, String message) throws Exception {
    Query q = new Query();
    q.setApplication(getParameter("application"));
    q.setInstance(getParameter("instance"));
    q.setConversation(client.getToken(serviceId()));
    q.setMessage(message);

    log.debug(this + " request: " + q);
    URI uri = new URI(getUrl());
    String body = getMapper().writeValueAsString(q);
    RequestEntity<String> requestEntity = RequestEntity.post(uri).contentType(MediaType.APPLICATION_JSON).body(body);
    ResponseEntity<String> result = restTemplate.exchange(requestEntity, String.class);
    log.debug(this + " response: " + result.getBody());
    return result;
  }

  private String serviceId() {
    return getObjectId().toString();
  }
}
