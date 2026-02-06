package org.vrspace.server.connect.ollama;

import java.util.Map;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.connect.OllamaConnector;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@ConditionalOnBean(OllamaConfig.class)
public class SceneAgent {
  @Autowired
  private OllamaConnector ollama;
  @Autowired
  private VRObjectRepository db;
  private PromptTemplate promptTemplate = ContextHelper.contextQueryTemplate();

  private ContextHelper contextHelper = contextHelper();

  private SystemMessage systemMessage = new SystemMessage(
      """
          You are an agent in a virtual world.
          Your task is to assist the user in navigation and interaction with world objects.
          The context contains user and world information, information about world objects and other users, and their locations from the user's point of view.
          """);
  // In world coordinate system, x axis points right, y axis points up, z axis points forward.
  // All coordinates are absolute, relative to the world point of origin.
  // Rotation is clockwise, around the orthogonal axis, y is yaw, x is pitch, z is roll. Yaw of 0 points toward positive z axis.
  // All coordinates are relative to the user, and user is coordinate system point of origin.
  // User position and rotation are absolute, given in world coordinates.
  // Coordinates of all other objects are relative to the user's position and rotation.

  public String query(Client client, String query, ChatMemory memory, String conversationId) {
    String context = "User " + contextHelper.sceneDescription(client, db);
    log.debug("Context:\n" + context);
    String message = promptTemplate.render(Map.of("query", query, "context", context));

    if (memory.get(conversationId).size() == 0) {
      log.debug("System messsage:\n" + systemMessage);
      memory.add(conversationId, systemMessage);
    }
    memory.add(conversationId, new UserMessage(message));
    long time = System.currentTimeMillis();
    Prompt prompt = Prompt.builder().messages(memory.get(conversationId)).build();
    ChatResponse response = ollama.toolsModel().call(prompt);
    time = System.currentTimeMillis() - time;
    log.debug("Response in " + time + " ms: \n" + response);
    memory.add(conversationId, response.getResult().getOutput());
    String answer = response.getResult().getOutput().getText();
    return answer;
  }

  private ContextHelper contextHelper() {
    ContextHelper ret = new ContextHelper();
    ret.appendDirection = true;
    return ret;
  }
}
