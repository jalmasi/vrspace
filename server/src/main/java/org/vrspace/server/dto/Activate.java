package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
public class Activate implements Command {
  private String className;
  private String id;
  private Boolean active;

  @Override
  public ClientResponse execute(WorldManager worldManager, Client client) throws Exception {
    if (active == null) {
      throw new IllegalArgumentException("Active must be either true or false");
    }
    ID activated = new ID(className, id);
    VRObject obj = client.getScene().get(activated);
    if (obj == null) {
      throw new IllegalArgumentException("Object not in scene: " + className + " " + id);
    }
    // check permissions, distribute the event, persist
    // the event is only distributed if object is currently active
    VREvent evt = new VREvent(obj, client);
    evt.addChange("active", active);
    worldManager.dispatch(evt);
    // maintain event model, distribute the command
    if (active) {
      obj.addListener(client);
    } else {
      obj.removeListener(client);
    }
    if (client.getListeners() != null) {
      for (VRObject o : client.getListeners().values()) {
        if (o instanceof Client) {
          Client c = (Client) o;
          if (c.getScene().get(activated) != null) {
            // the object is in the scene
            c.sendMessage(this);
            if (active) {
              obj.addListener(c);
            } else {
              obj.removeListener(c);
            }
          }
        }
      }
    }
    client.sendMessage(this);
    return null;
  }

}
