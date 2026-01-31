package org.vrspace.server.obj;

import java.util.Map;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.ollama.api.common.OllamaApiConstants;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.template.st.StTemplateRenderer;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.dto.VREvent;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

@Slf4j
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class OllamaBot extends Bot {
  // CHECKME all of these are transient and ignored
  // we may want to persist or publish some
  @JsonIgnore
  @Transient
  private transient String modelName = "ministral-3:3b";
  @JsonIgnore
  @Transient
  private OllamaChatModel chatModel;
  @JsonIgnore
  @Transient
  private int contextWindowSize = 65536;
  @JsonIgnore
  @Transient
  private String keepAlive = "1m";
  @JsonIgnore
  @Transient
  private int memorySize = 11;
  @JsonIgnore
  @Transient
  private SystemMessage systemMessage = new SystemMessage(
      """
              You are VirBot, a friendly chatbot in a virtual world.
              World coordinate system x axis points right, y axis points up, z axis points forward. Rotation is counter-clockwise, around the orthogonal axis.
              Your avatar can perform gestures, and move in the world.
              The context contains information about user, your avatar, and list of gestures available to you.
          """);
  @JsonIgnore
  @Transient
  private PromptTemplate promptTemplate = PromptTemplate
      .builder()
      .renderer(StTemplateRenderer.builder().startDelimiterToken('<').endDelimiterToken('>').build())
      .template("""
              Query: <query>

              Context:
              --------------------
              <context>
              --------------------
          """)
      .build();
  @JsonIgnore
  @Transient
  private ChatMemory memory;
  @JsonIgnore
  @Transient
  private String conversationId;
  @JsonIgnore
  @Transient
  private volatile boolean processing = false;

  @Override
  public void selfTest() throws Exception {
    if (getUrl() == null) {
      setUrl(OllamaApiConstants.DEFAULT_BASE_URL);
    }
    // TODO process parameterMap, getParameter()
    chatModel = OllamaChatModel
        .builder()
        .ollamaApi(OllamaApi.builder().baseUrl(getUrl()).build())
        .defaultOptions(
            OllamaChatOptions.builder().numCtx(getContextWindowSize()).model(getModelName()).keepAlive(getKeepAlive()).build())
        .build();
    memory = MessageWindowChatMemory
        .builder()
        .maxMessages(getMemorySize())
        .chatMemoryRepository(new InMemoryChatMemoryRepository())
        .build();
    conversationId = this.getId();
  }

  @Override
  public Mono<String> getResponseAsync(Client c, String query) {
    log.debug("Query from " + c.getId() + " " + query);
    StringBuilder gestures = new StringBuilder();
    this.getAnimations().forEach(gesture -> {
      gestures.append(gesture);
      gestures.append(" ");
    });
    String context = "Query from User " + c.getId() + " Name " + c.getName() + " position x=" + c.getPosition().getX() + ",y="
        + c.getPosition().getY() + ",z=" + c.getPosition().getZ() + " rotation x=" + c.getRotation().getX() + ",y="
        + c.getRotation().getY() + ",z=" + c.getRotation().getZ() + "\nYour avatar position x=" + getPosition().getX() + ",y="
        + getPosition().getY() + ",z=" + getPosition().getZ() + " rotation x=" + getRotation().getX() + ",y="
        + getRotation().getY() + ",z=" + getRotation().getZ() + "\nGestures available: " + gestures.toString();

    String message = promptTemplate.render(Map.of("query", query, "context", context));
    if (memory.get(conversationId).size() == 0) {
      memory.add(conversationId, systemMessage);
    }
    memory.add(conversationId, new UserMessage(message));
    log.debug("Memory " + conversationId + " size: " + memory.get(conversationId).size());
    log.debug("Context:\n" + context);

    if (processing) {
      return Mono.just(null);
    } else {
      return Mono.create((sink) -> {
        try {
          processing = true;
          long time = System.currentTimeMillis();
          Prompt prompt = Prompt
              .builder()
              .messages(memory.get(conversationId))
              .chatOptions(OllamaChatOptions.builder().toolCallbacks(ToolCallbacks.from(this)).build())
              .build();
          ChatResponse response = chatModel.call(prompt);
          time = System.currentTimeMillis() - time;
          log.debug("Response in " + time + " ms: \n" + response);
          memory.add(conversationId, response.getResult().getOutput());
          processing = false;
          sink.success(response.getResult().getOutput().getText());
        } catch (Exception e) {
          processing = false;
          log.error("Exception processing user query " + query, e);
          sink.error(e);
        }
      });
    }
  }

  @Tool(description = "Perform a gesture")
  public void gesture(String gestureName) {
    log.debug("Performing gesture " + gestureName);
    VREvent event = new VREvent(this, this);
    event.addChange("animation", new Animation(gestureName, false, 1));
    notifyListeners(event);
  }

  @Tool(description = "Move to position")
  public void move(Double x, Double y, Double z) {
    log.debug("Moving to " + x + "," + y + "," + z);
    VREvent event = new VREvent(this, this);
    this.setPosition(new Point(x, y, z));
    event.addChange("position", this.getPosition());
    notifyListeners(event);
  }

  @Tool(description = "Rotate")
  public void rotate(Double x, Double y, Double z) {
    log.debug("Rotating to " + x + "," + y + "," + z);
    VREvent event = new VREvent(this, this);
    this.setRotation(new Rotation(x, y, z));
    event.addChange("rotation", this.getRotation());
    notifyListeners(event);
  }
}
