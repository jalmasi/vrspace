package org.vrspace.server.dto;

import java.util.Collection;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Add is both a Command and a DTO. Add command is issued by a client to add
 * some object(s) to the world. The client becomes owner of all added objects.
 * Add DTO is sent to clients when new objects (typically users) enter the
 * scene. JSON message structure for both cases is the same.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
public class Add implements Command {
  /**
   * List of VRObjects to add.
   */
  List<VRObject> objects = new LinkedList<VRObject>();

  public Add(Collection<VRObject> objects) {
    this.objects.addAll(objects);
  }

  public Add(VRObject... objects) {
    for (VRObject t : objects) {
      addObject(t);
    }
  }

  public Add addObject(VRObject t) {
    this.objects.add(t);
    return this;
  }

  /**
   * Add objects to the scene, returns List of object identifiers (classname+id
   * pairs)
   */
  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    List<VRObject> added = world.add(client, objects);
    client.getScene().publishAll(added);
    List<Map<String, Long>> ret = added.stream().map(o -> o.getObjectId().map()).collect(Collectors.toList());
    return new ClientResponse(ret);
  }
}
