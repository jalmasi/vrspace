package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class UserRelated {
  String uid;
  String username;
  String displayName;
  String profileUrl;
  String account;
  String uri;
  AvatarRelated avatar;
}
