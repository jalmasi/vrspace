package org.vrspace.server.api.sketchfab;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AuthResponse {
  private String access_token;
  private int expires_in;
  private String token_type;
  private String scope;
  private String refresh_token;
}
