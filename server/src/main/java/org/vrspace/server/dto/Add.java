package org.vrspace.server.dto;

import java.util.Collection;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
public class Add implements Command {
  List<VRObject> objects = new LinkedList<VRObject>();

  public Add(Collection<VRObject> objects) {
    objects.forEach(t -> objects.add(t));
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

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    List<Map<String, Long>> ret = world.add(client, objects).stream().map(ID::map).collect(Collectors.toList());
    client.getScene().setDirty();
    return new ClientResponse(ret);
  }
}
