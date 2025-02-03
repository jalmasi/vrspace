package org.vrspace.server.dto;

import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.UserGroup;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

/**
 * A message from a client sent to the group
 * 
 * @author joe
 *
 */
@Data
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@JsonInclude(Include.NON_EMPTY)
@NoArgsConstructor
@RequiredArgsConstructor
@AllArgsConstructor
public class GroupMessage {
  @NonNull
  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
  private Client from;
  private UserGroup group;
  private String message;
}
