package org.vrspace.server.connect.ollama;

import java.util.Map;
import java.util.Optional;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.template.st.StTemplateRenderer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.connect.OllamaConnector;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GltfModel;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@ConditionalOnBean(OllamaConfig.class)
public class SceneAgent {
  @Autowired
  private OllamaConnector ollama;
  @Autowired
  private VRObjectRepository db;
  @Autowired
  ObjectMapper objectMapper;
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

  private SystemMessage systemMessage = new SystemMessage(
      """
              You are an agent in a virtual world.
              Your task is to assist the user in navigation and interaction with world objects.
              In world coordinate system x axis points right, y axis points up, z axis points forward. Rotation is counter-clockwise, around the orthogonal axis.
              The context contains world information, user position, rotation and avatar, and information about world objects and other users.
              All coordinates are absolute, but you need to answer questions from user's point of view.
          """);

  public String query(Client client, String query, ChatMemory memory, String conversationId) {
    StringBuilder sb = new StringBuilder();
    sb.append("World: ");
    sb.append(client.getWorld().getName());
    sb.append("\nPosition: ");
    sb.append(client.getPosition());
    sb.append("\nRotation: ");
    sb.append(client.getRotation());
    sb.append("\nAvatar: ");
    sb.append(client.getMesh());
    for (VRObject obj : client.getScene().getAll()) {
      ID id = obj.getObjectId();
      sb.append("\n- ");
      sb.append(id.getClassName());
      sb.append(" ");
      sb.append(id.getId());
      sb.append(" Position: ");
      sb.append(obj.getPosition());
      sb.append(" Rotation: ");
      sb.append(obj.getRotation());
      if (obj.getMesh() == null) {
        // TODO, script, terrain, background
      }
      {
        sb.append(" URL: ");
        sb.append(obj.getMesh());
        sb.append(" Permanent: ");
        sb.append(obj.getPermanent());
        sb.append(" Active: ");
        sb.append(obj.getActive());
        Optional<GltfModel> oModel = db.findGltfModelByMesh(obj.getMesh());
        if (oModel.isEmpty()) {
          log.warn("Unknown model for mesh " + obj);
        } else {
          GltfModel model = oModel.get();
          sb.append(" Name: ");
          sb.append(model.getName());
          sb.append(" Author: ");
          sb.append(model.getAuthor());
          sb.append(" Animated: ");
          sb.append(model.getAnimated());
          sb.append(" Rigged: ");
          sb.append(model.getRigged());
          sb.append(" Description: ");
          sb.append(model.getDescription()); // CHECKME: trim?
        }
      }
    }
    String context = sb.toString();
    log.debug(context);
    String message = promptTemplate.render(Map.of("query", query, "context", context));

    memory.add(conversationId, systemMessage);
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
}
