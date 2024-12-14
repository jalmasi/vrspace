package org.vrspace.server.obj;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.core.JsonProcessingException;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

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

  // @JsonIgnore
  // @Transient
  // private RestTemplate restTemplate = new RestTemplate();
  @JsonIgnore
  @Transient
  private WebClient webClient = WebClient.create();

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
    log.debug(getResponseAsync(new Client(), "hello again").onErrorResume(e -> Mono.error(e)).block());
  }

  @Override
  public Mono<String> getResponseAsync(Client client, String message) {
    Query q = new Query();
    q.setApplication(getParameter("application"));
    q.setInstance(getParameter("instance"));
    q.setConversation(client.getToken(serviceId()));
    q.setMessage(message);
    log.debug(this + " request: " + q);
    try {
      return webClient.post().uri(getUrl()).contentType(MediaType.APPLICATION_JSON)
          .bodyValue(getMapper().writeValueAsString(q)).exchangeToMono(clientResponse -> {
            if (clientResponse.statusCode().equals(HttpStatus.OK)) {
              return clientResponse.bodyToMono(Response.class).map(response -> {
                String ret = response.getMessage();
                String conversationId = response.getConversation();
                client.setToken(serviceId(), conversationId);
                return ret;
              });
            } else {
              return clientResponse.createException().flatMap(Mono::error);
            }
          });
    } catch (JsonProcessingException e) {
      log.error("Can't get response to: " + message, e);
      return Mono.error(e);
    }
  }

  private String serviceId() {
    return getObjectId().toString();
  }
}
