package org.vrspace.server.api.sketchfab;

import java.util.List;

import lombok.Data;

@Data
public class AvatarRelated {
  String uid;
  String uri;
  List<ImageInfo> images;
}
