package org.vrspace.server.dto;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

@Data
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@JsonInclude(Include.NON_EMPTY)
@NoArgsConstructor
@RequiredArgsConstructor
public class Welcome {
  @NonNull
  @JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
  private Client client;
  @NonNull
  private Set<VRObject> permanents;

  private LocalDateTime timestamp = LocalDateTime.now(ZoneId.of("UTC"));

  public Welcome(Client client, VRObject... permanents) {
    this.client = client;
    this.permanents = new HashSet<VRObject>();
    for (VRObject o : permanents) {
      this.permanents.add(o);
    }
  }
}
