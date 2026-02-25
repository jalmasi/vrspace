package org.vrspace.server.connect.ollama;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Collection;
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

/**
 * Class that helps with presentation of the world to LLM. Generally, LLMs are bad in dealing with spatial information, spatial
 * intelligence may be a different than language intelligence. Thus, this attempt to make it somewhat useful: public flags
 * define what we add to the context. It can add relative or absolute coordinates, rotation of, and direction to world objects.
 * So, a model could answer questions like where is that user/object etc. Background and terrain information are also added to
 * the context if present.
 * 
 * @author joe
 *
 */
@Slf4j
// CHECKME no dependencies on ollama, move to some other package?
public class ContextHelper {

  /** When using absolute world coordinates, we should add current position and rotation of the client */
  public boolean appendClientCoordinates;
  /** Add absolute coordinates to the context? */
  public boolean appendAbsolute;
  /** Add coordinates relative to the user position? */
  public boolean appendRelative;
  /** Add directions (left/right/back/forward) to objects? */
  public boolean appendDirection;
  /** Add object rotations? */
  public boolean appendRotation;

  private DecimalFormat numberFormat = new DecimalFormat("#.##");

  /**
   * Get description of the scene to be used as (part of) the context. Groups all the objects in current user scene, and returns
   * a string containing their description. First line of the string contains basic information about the client: id, name,
   * optionally position and rotation, and avatar URL. Second line contains world info: name and description. Then, the list of
   * world object follows. For each model, number of instances, URL, description and author are added. For each instance,
   * coordinates are added, as defined by append flags.
   * 
   * @param client
   * @param db
   * @return description of the scene
   */
  public String sceneDescription(Client client, VRObjectRepository db) {
    HashMap<String, List<VRObject>> grouped = new HashMap<>();
    StringBuilder sb = new StringBuilder();
    // client info
    sb.append("ID: " + client.getId());
    if (client.getName() != null) {
      sb.append(" Name: ");
      sb.append(client.getName());
    }
    // appendZeroCoordinates(sb);
    if (appendClientCoordinates) {
      appendPosition(sb, client.getPosition());
      appendRotation(sb, client.getRotation());
    }
    if (client.getMesh() != null) {
      sb.append(" Avatar: ");
      sb.append(client.getMesh());
    }
    // world info
    sb.append("\nWorld: ");
    sb.append(client.getWorld().getName());
    if (client.getWorld().getDescription() != null) {
      sb.append(", ");
      sb.append(client.getWorld().getDescription().trim());
    }

    Collection<VRObject> scene = client.getScene().getAll();
    if (scene.size() > 0) {
      sb.append("\nList of world objects:");
    }
    // object positions and attributes for special objects without URL
    for (VRObject obj : scene) {
      if (obj.getMesh() == null) {
        ID id = obj.getObjectId();
        sb.append("\n- ");
        sb.append(id.getClassName());
        sb.append(" ");
        sb.append(id.getId());
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
              /*
              sb.append(" (x=");
              append(sb, tp.getX());
              sb.append(", y=");
              append(sb, tp.getY());
              sb.append(", z=");
              append(sb, tp.getZ());
              sb.append(")");
              */
              sb.append(" (");
              // appendDirection(sb, tp.getX(), tp.getY(), tp.getZ(), client);
              appendCoordinates(sb, client, new Point(tp.getX(), tp.getY(), tp.getZ()), null);
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
        appendCoordinates(sb, client, obj.getPosition(), obj.getRotation());
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
        appendCoordinates(sb, client, obj.getPosition(), obj.getRotation());
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

  private void appendCoordinates(StringBuilder sb, Client client, Point position, Rotation rotation) {
    if (appendAbsolute)
      appendPosition(sb, position);
    if (appendRelative)
      appendRelativePosition(sb, position, client);
    if (appendDirection)
      appendDirection(sb, position, client);
    if (appendRotation)
      appendRotation(sb, rotation);
  }

  private void appendZeroCoordinates(StringBuilder sb) {
    sb.append(" Position: ");
    sb.append("x=0");
    sb.append(",y=0");
    sb.append(",z=0");
    sb.append(" Rotation: ");
    sb.append("x=0");
    sb.append(",y=0");
    sb.append(",z=0");
  }

  private void appendPosition(StringBuilder sb, Point position) {
    if (position != null) {
      sb.append(" Position: ");
      sb.append("x=");
      append(sb, position.getX());
      sb.append(",y=");
      append(sb, position.getY());
      sb.append(",z=");
      append(sb, position.getZ());
    }
  }

  private void appendDirection(StringBuilder sb, Point position, Client client) {
    if (position != null) {
      Point point = position.subtract(client.getPosition());
      appendDirection(sb, point.getX(), point.getY(), point.getZ(), client);
    }
  }

  void appendDirection(StringBuilder sb, double x, double y, double z, Client client) {
    Double originalAngle = Math.atan2(x, z);
    if (client.getRotation() == null) {
      return;
    }
    Double angle = originalAngle - client.getRotation().getY();
    double d = Math.sqrt(x * x + z * z);
    x = Math.sin(angle) * d;
    z = Math.cos(angle) * d;
    double ax = Math.abs(x);
    double az = Math.abs(z);
    double ay = Math.abs(y);
    String leftRight = "";
    if (x > 0.01) {
      leftRight = " right: " + format(ax);
    } else if (x < 0.01) {
      leftRight = " left: " + format(ax);
    }
    String frontBack = "";
    if (z > 0.01) {
      frontBack = " forward: " + format(az);
    } else if (z < 0.01) {
      frontBack = " behind: " + format(az);
    }
    String upDown = "";
    if (y > 0.01) {
      upDown = " above: " + format(ay);
    } else if (y < 0.01) {
      upDown = " below: " + format(ay);
    }
    if (ax > az) {
      sb.append(leftRight);
      sb.append(frontBack);
    } else {
      sb.append(frontBack);
      sb.append(leftRight);
    }
    sb.append(upDown);
  }

  private void appendRelativePosition(StringBuilder sb, Point position, Client client) {
    if (position != null) {
      Point point = position.subtract(client.getPosition());
      // and now rotate point around y in the opposite direction
      Double originalAngle = Math.atan2(point.getX(), point.getZ());
      Double angle = originalAngle - client.getRotation().getY();
      double d = Math.sqrt(point.getX() * point.getX() + point.getZ() * point.getZ());
      double s = Math.sin(angle);
      double c = Math.cos(angle);
      point.setX(s * d);
      point.setZ(c * d);
      // CHECKME should works somewhat like this:
      // point.setX(point.getX() * c + point.getZ() * s);
      // point.setZ(-point.getX() * s + point.getZ() * c);
      sb.append(" Position: ");
      sb.append("x=");
      append(sb, point.getX());
      sb.append(",y=");
      append(sb, point.getY());
      sb.append(",z=");
      append(sb, point.getZ());
    }
  }

  // LLM can't handle rotations correctly
  private void appendRotation(StringBuilder sb, Rotation rotation) {
    if (rotation != null) {
      // sb.append(" ");
      // sb.append(obj.getRotation().toString());
      sb.append(" Rotation: ");
      sb.append("x=");
      append(sb, rotation.getX());
      sb.append(",y=");
      append(sb, rotation.getY());
      sb.append(",z=");
      append(sb, rotation.getZ());
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

  private void append(StringBuilder sb, Double number) {
    sb.append(format(number));
  }

  private String format(Double number) {
    return numberFormat.format(number);
  }
}
