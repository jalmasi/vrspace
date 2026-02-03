package org.vrspace.server.connect.ollama;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.template.st.StTemplateRenderer;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Background;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GltfModel;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.Rotation;
import org.vrspace.server.obj.Terrain;
import org.vrspace.server.obj.TerrainPoint;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import lombok.extern.slf4j.Slf4j;

// CHECKME no dependencies on ollama, move to some other package
@Slf4j
public class ContextUtil {

  public static String sceneDescription(Client client, VRObjectRepository db) {
    HashMap<String, List<VRObject>> grouped = new HashMap<>();
    StringBuilder sb = new StringBuilder();
    // client info
    sb.append("ID: " + client.getId());
    if (client.getName() != null) {
      sb.append(" Name: ");
      sb.append(client.getName());
    }
    appendPosition(sb, client);
    appendRotation(sb, client);
    sb.append(" Avatar: ");
    sb.append(client.getMesh());
    // world info
    sb.append("\nWorld: ");
    sb.append(client.getWorld().getName());
    if (client.getWorld().getDescription() != null) {
      sb.append(", ");
      sb.append(client.getWorld().getDescription().trim());
    }

    // object positions and attributes for special objects without URL
    for (VRObject obj : client.getScene().getAll()) {
      if (obj.getMesh() == null) {
        ID id = obj.getObjectId();
        sb.append("\n- ");
        sb.append(id.getClassName());
        sb.append(" ");
        sb.append(id.getId());
        appendPosition(sb, obj);
        appendRotation(sb, obj);
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

    // object instances and descriptions for objects with URL
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
        appendPosition(sb, obj);
        appendRotation(sb, obj);
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

    return sb.toString();
  }

  private static void appendPosition(StringBuilder sb, VRObject obj) {
    if (obj.getPosition() != null) {
      sb.append(" Position: ");
      Point point = obj.getPosition();
      sb.append("x=");
      sb.append(point.getX());
      sb.append(",y=");
      sb.append(point.getY());
      sb.append(",z=");
      sb.append(point.getZ());
    }
  }

  private static void appendRotation(StringBuilder sb, VRObject obj) {
    if (obj.getRotation() != null) {
      // sb.append(" ");
      // sb.append(obj.getRotation().toString());
      sb.append(" Rotation: ");
      Rotation rot = obj.getRotation();
      sb.append("x=");
      sb.append(rot.getX());
      sb.append(",y=");
      sb.append(rot.getY());
      sb.append(",z=");
      sb.append(rot.getZ());
      /* TODO quaternion is different
      if (rot.getAngle() != null) {
        // quaternion
        sb.append(",angle=");
        sb.append(rot.getAngle());
      }
      */
    }
  }

  public static PromptTemplate contextQueryTemplate() {
    return PromptTemplate
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
  }
}
