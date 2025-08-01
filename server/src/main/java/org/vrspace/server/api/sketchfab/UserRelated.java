package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class UserRelated {
  String username;
  String profileUrl;
  String account;
  String displayName;
  String uid;
  String uri;
  AvatarRelated avatar;
}
