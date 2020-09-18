package org.vrspace.server.dto;

import org.vrspace.server.core.CustomTypeIdResolver;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.annotation.JsonTypeIdResolver;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@JsonInclude(Include.NON_EMPTY)
@ToString(callSuper = true)
public class ClientRequest extends VREvent {
  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
  @JsonTypeIdResolver(CustomTypeIdResolver.class)
  private Command command;

  public ClientRequest(VRObject obj) {
    super(obj);
  }

  public ClientRequest(Client client, Command cmd) {
    this.command = cmd;
    setClient(client);
  }

  public boolean isCommand() {
    return command != null;
  }

}
