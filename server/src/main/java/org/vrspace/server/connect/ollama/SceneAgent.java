package org.vrspace.server.connect.ollama;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
import org.vrspace.server.obj.Background;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GltfModel;
import org.vrspace.server.obj.Terrain;
import org.vrspace.server.obj.TerrainPoint;
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
    HashMap<String, List<VRObject>> grouped = new HashMap<>();
    StringBuilder sb = new StringBuilder();
    sb.append("World: ");
    sb.append(client.getWorld().getName());
    if (client.getName() != null) {
      sb.append("\nName: ");
      sb.append(client.getName());
    }
    sb.append("\nPosition: ");
    sb.append(client.getPosition());
    sb.append("\nRotation: ");
    sb.append(client.getRotation());
    sb.append("\nAvatar: ");
    sb.append(client.getMesh());
    for (VRObject obj : client.getScene().getAll()) {
      if (obj.getMesh() == null) {
        ID id = obj.getObjectId();
        sb.append("\n- ");
        sb.append(id.getClassName());
        sb.append(" ");
        sb.append(id.getId());
        if (obj.getPosition() != null) {
          sb.append(" Position: ");
          sb.append(obj.getPosition());
        }
        if (obj.getRotation() != null) {
          sb.append(" Rotation: ");
          sb.append(obj.getRotation());
        }
        if (obj.getPermanent() != null) {
          sb.append(" Permanent: ");
          sb.append(obj.getPermanent());
        }
        if (obj.getActive() != null) {
          sb.append(" Active: ");
          sb.append(obj.getActive());
        }
        if (obj.getScript() != null) {
          log.debug("TODO: script " + obj);
        } else if (obj instanceof Terrain) {
          Terrain terrain = (Terrain) obj;
          sb.append(" Color: ");
          sb.append(terrain.getDiffuseColor());
          if (terrain.getDiffuseTexture() != null) {
            sb.append(" Texture: ");
            sb.append(terrain.getDiffuseTexture());
          }
          // terrain.getEmissiveColor();
          if (terrain.getPoints() != null && terrain.getPoints().size() > 0) {
            sb.append(" Points:");
            for (TerrainPoint tp : terrain.getPoints()) {
              sb.append(" (x=");
              sb.append(tp.getX());
              sb.append(", y=");
              sb.append(tp.getY());
              sb.append(", z=");
              sb.append(tp.getZ());
              sb.append(")");
            }
          }
        } else if (obj instanceof Background) {
          Background background = (Background) obj;
          sb.append(" Texture: ");
          sb.append(background.getTexture());
          // background.getAmbientIntensity();
        }
      } else {
        List<VRObject> group = grouped.get(obj.getMesh());
        if (group == null) {
          group = new ArrayList<VRObject>();
          grouped.put(obj.getMesh(), group);
        }
        group.add(obj);
      }
    }

    for (List<VRObject> group : grouped.values()) {
      sb.append("\n- URL: ");
      sb.append(group.get(0).getMesh());
      sb.append(" Instances ");
      sb.append(group.size());
      sb.append(": ");
      for (VRObject obj : group) {
        ID id = obj.getObjectId();
        sb.append(id.getClassName());
        sb.append("(");
        sb.append(id.getId());
        if (obj instanceof Client) {
          Client c = (Client) obj;
          if (c.getName() != null) {
            sb.append(" Name: ");
            sb.append(c.getName());
          }
        }
        sb.append(" Position: ");
        sb.append(obj.getPosition());
        if (obj.getRotation() != null) {
          sb.append(" Rotation: ");
          sb.append(obj.getRotation());
        }
        if (obj.getPermanent() != null) {
          sb.append(" Permanent: ");
          sb.append(obj.getPermanent());
        }
        sb.append(" Active: ");
        sb.append(obj.getActive());
        sb.append(") ");
      }

      Optional<GltfModel> oModel = db.findGltfModelByMesh(group.get(0).getMesh());
      if (oModel.isEmpty()) {
        log.warn("Unknown model for mesh " + group.get(0));
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
