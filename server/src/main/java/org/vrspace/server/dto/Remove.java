package org.vrspace.server.dto;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Remove object from the scene or world. This message is sent by the server
 * when objects are removed from the scene, i.e. no longer visible. But when
 * client sends the message, objects are removed from the world. JSON message
 * structure is the same in both cases.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
public class Remove implements Command {
  /** List of objects identifiers (class name + id pairs) to remove */
  @JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
  private List<Map<String, Long>> objects = new ArrayList<Map<String, Long>>();

  @JsonIgnore
  private Iterator<Map<String, Long>> iterator;

  public Remove(VRObject obj) {
    removeObject(obj);
  }

  public Remove(String className, Long id) {
    objects.add(new ID(className, id).map());
  }

  public Remove(ID... ids) {
    for (ID id : ids) {
      objects.add(id.map());
    }
  }

  public Remove(List<Map<String, Long>> objects) {
    this.objects = objects;
  }

  public Remove removeObject(VRObject obj) {
    objects.add(new ID(obj).map());
    return this;
  }

  public Remove remove(String className, Long id) {
    objects.add(new ID(className, id).map());
    return this;
  }

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    List<VRObject> removing = new ArrayList<VRObject>();
    objects.forEach(o -> o.forEach((cls, id) -> {
      ID objId = new ID(cls, id);
      VRObject obj = client.getScene().get(objId);
      if (obj != null) {
        removing.add(obj);
        world.remove(client, obj);
      }
    }));
    client.getScene().unpublish(removing);
    return null;
  }

  public ID next() {
    ID ret = null;
    if (iterator == null) {
      iterator = objects.iterator();
    }
    if (iterator.hasNext()) {
      ret = new ID(iterator.next());
    }
    return ret;
  }

}
