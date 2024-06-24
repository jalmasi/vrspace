package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
public class Streaming extends Add {

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    // FIXME: must not be hardcoded
    this.objects.forEach(o -> o.setScript("/babylon/js/scripts/remote-screen.js"));
    return super.execute(world, client);
  }

}
