package org.vrspace.server.dto;

import java.util.Set;

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
  public static final Set<String> allowedScripts = Set.of("/babylon/js/scripts/remote-screen.js",
      "/babylon/js/scripts/remote-whiteboard.js", "/babylon/js/scripts/shared-file.js",
      "/babylon/js/scripts/shared-image.js");

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    // FIXME: must not be hardcoded
    this.objects.forEach(o -> {
      if (o.getScript() != null && !allowedScripts.contains(o.getScript())) {
        throw new SecurityException("Disallowed script path: " + o.getScript());
      }
    });
    return super.execute(world, client);
  }

}
