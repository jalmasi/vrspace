package org.vrspace.server.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;

/**
 * That's one bad flexible solution: a command can return anything.
 */
@Data
@NoArgsConstructor
@RequiredArgsConstructor
public class ClientResponse {
  @NonNull
  private Object response;
}
