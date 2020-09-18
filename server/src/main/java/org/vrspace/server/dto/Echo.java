package org.vrspace.server.dto;

import org.vrspace.server.core.CustomTypeIdResolver;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.annotation.JsonTypeIdResolver;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Echoes back the command for e.g. client development purposes. Examples
 * {"command":{"Echo":{"command":{"Remove":{"objects":[{"VRObject":1},{"VRObject":2},{"Client":1}]}}}}}
 * {"command":{"Echo":{"event":{"object":{"VRObject":1},"changes":{"field1":"value2","field2":5,"field3":{"id":2},"field4":{"one":1,"two":"two"}}}}}}
 * {"command":{"Echo":{"event":{"object":{"Client":0},"changes":{"name":"NewClientName"}}}}}
 */
@Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
public class Echo implements Command {
  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
  @JsonTypeIdResolver(CustomTypeIdResolver.class)
  public Command command;
  public VREvent event;

  public Echo(Command command) {
    this.command = command;
  }

  public Echo(VREvent event) {
    this.event = event;
  }

  @Override
  public ClientResponse execute(WorldManager world, Client client) {
    if (command != null) {
      // return command;
      client.sendMessage(command);
    } else if (event != null) {
      // return event;
      client.sendMessage(event);
    } else {
      throw new IllegalArgumentException("Nothing to echo");
    }
    return null;
  }
}
