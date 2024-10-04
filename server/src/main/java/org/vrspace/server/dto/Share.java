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
public class Share extends Add {
  public static final String allowedPath = "/babylon/js/";

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    // FIXME: must not be hardcoded
    // CHECKME: seems pointless - why wouldn't malicious client simply use Add cmd
    // instead?
    this.objects.forEach(o -> {
      if (o.getScript() != null && !o.getScript().startsWith(allowedPath)) {
        throw new SecurityException("Disallowed script path: " + o.getScript());
      }
    });
    return super.execute(world, client);
  }

}
