package org.vrspace.server.connect.sketchfab;

import java.util.List;

import lombok.Data;

@Data
public class AvatarRelated {
  String uid;
  String uri;
  List<ImageInfo> images;
}
