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
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.retry.support.RetryTemplate;
import org.vrspace.server.connect.ollama.ContextHelper;
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
  private SystemMessage systemMessage;
  @JsonIgnore
  @Transient
  private PromptTemplate promptTemplate = ContextHelper.contextQueryTemplate();
  @JsonIgnore
  @Transient
  private ChatMemory memory;
  @JsonIgnore
  @Transient
  private String conversationId;
  @JsonIgnore
  @Transient
  private ContextHelper contextHelper = contextHelper();

  @Override
  public void selfTest() throws Exception {
    if (getUrl() == null) {
      setUrl(OllamaApiConstants.DEFAULT_BASE_URL);
    }
    // TODO process parameterMap, getParameter()
    chatModel = OllamaChatModel
        .builder()
        .retryTemplate(RetryTemplate.builder().maxAttempts(1).build())
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
    log.info("OllamaBot " + this.getId() + " " + this.getName() + " initialized");
  }

  @Override
  public Mono<String> getResponseAsync(Client c, String query) {
    String clientId = c.getObjectId().getIdString();
    log.debug("Query from " + clientId + " " + query);
    StringBuilder gestures = new StringBuilder();
    this.getAnimations().forEach(gesture -> {
      gestures.append(gesture);
      gestures.append(" ");
    });
    String context = "Query from " + clientId + " Name " + c.getName();
    context += "\nGestures available: " + gestures.toString();
    context += "\nYou are " + contextHelper.sceneDescription(this, getWorldManager().getDb());

    String message = promptTemplate.render(Map.of("query", query, "context", context));
    if (memory.get(conversationId).size() == 0) {
      memory.add(conversationId, systemMessage());
    }
    memory.add(conversationId, new UserMessage(message));
    log.debug("Memory " + conversationId + " size: " + memory.get(conversationId).size());
    log.debug("Context:\n" + context);

    if (processing) {
      log.debug("Already processing, ignored message from " + clientId);
      return Mono.empty();
    }

    processing = true;
    return Mono.create((sink) -> {
      try {
        long time = System.currentTimeMillis();
        Prompt prompt = Prompt
            .builder()
            .messages(memory.get(conversationId))
            .chatOptions(OllamaChatOptions.builder().toolCallbacks(ToolCallbacks.from(this)).build())
            .build();
        ChatResponse response = chatModel.call(prompt);
        time = System.currentTimeMillis() - time;
        log.debug(getName() + " Response in " + time + " ms: \n" + response);
        memory.add(conversationId, response.getResult().getOutput());
        sink.success(response.getResult().getOutput().getText());
      } catch (Exception e) {
        processing = false;
        log.error("Exception processing user query " + query, e);
        sink.error(e);
      }
    });
  }

  @Tool(description = "Perform a gesture")
  public void gesture(String gestureName) {
    log.debug(getName() + " Performing gesture " + gestureName);
    VREvent event = new VREvent(this, this);
    event.addChange("animation", new Animation(gestureName, false, 1));
    notifyListeners(event);
  }

  @Tool(description = "Move to position")
  public void move(Double x, Double y, Double z) {
    log.debug(getName() + " Moving to " + x + "," + y + "," + z);
    for (VRObject obj : this.getScene().getAll()) {
      if (obj.getPosition() != null && obj.getPosition().getDistance(x, y, z) <= 1) {
        double dx = obj.getPosition().getX() - this.getPosition().getX();
        double dy = obj.getPosition().getY() - this.getPosition().getY();
        double dz = obj.getPosition().getZ() - this.getPosition().getZ();
        if (Math.abs(dx) >= 1) {
          x -= Math.signum(dx);
        }
        if (Math.abs(dz) >= 1) {
          z -= Math.signum(dz);
        }
        log.warn("Destination changed to " + x + "," + y + "," + z + " - object in range: " + obj);
      }
    }
    VREvent event = new VREvent(this, this);
    this.setPosition(new Point(x, y, z));
    event.addChange("position", this.getPosition());
    notifyListeners(event);
  }

  @Tool(description = "Set rotation around y axis to given angle")
  public void setRotation(@ToolParam(description = "Destination angle in radians") Double angle) {
    log.debug(getName() + " Rotating to " + angle);
    VREvent event = new VREvent(this, this);
    this.setRotation(new Rotation(0, angle, 0));
    event.addChange("rotation", this.getRotation());
    notifyListeners(event);
  }

  @Tool(description = "Rotate around y axis for an angle")
  public void rotate(@ToolParam(description = "Additional angle in radians") Double angle) {
    log.debug(getName() + " Rotating for " + angle);
    VREvent event = new VREvent(this, this);
    this.setRotation(new Rotation(0, this.getRotation().getY() + angle, 0));
    event.addChange("rotation", this.getRotation());
    notifyListeners(event);
  }

  @Tool(description = "Set your rotation to make your avatar look at given point")
  public void lookAt(Double x, Double y, Double z) {
    Double dx = x - this.getPosition().getX();
    Double dz = z - this.getPosition().getZ();
    Double angle = Math.atan2(dx, dz);
    log.debug(getName() + " Looking at " + x + "," + y + "," + z + " angle=" + angle);
    VREvent event = new VREvent(this, this);
    this.setRotation(new Rotation(0, angle, 0));
    event.addChange("rotation", this.getRotation());
    notifyListeners(event);
  }

  private ContextHelper contextHelper() {
    ContextHelper ret = new ContextHelper();
    ret.appendClientCoordinates = true;
    ret.appendAbsolute = true;
    ret.appendRotation = true;
    return ret;
  }

  private SystemMessage systemMessage() {
    if (systemMessage == null) {
      systemMessage = new SystemMessage("""
            You are {botName}, a friendly chatbot in a virtual world.
            In world coordinate system, x axis points east, y axis points up, z axis points north. All coordinates are absolute.
            Rotation is counter-clockwise, around the orthogonal axis.
            Your avatar can move in the world, and perform gestures, one at a time..
            You can rotate around y axis, 0 means looking north, 3.14 south, 1.57 east, -1.57 west.
            Information about your avatar and list of gestures are in the context.
            The context also contains world and user information, and information about world objects and other users.
          """.replace("{botName}", getName()));
      log.debug("System message:\n" + systemMessage);
    }
    return systemMessage;
  }
}
