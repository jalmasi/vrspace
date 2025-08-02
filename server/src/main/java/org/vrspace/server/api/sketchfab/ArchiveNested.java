package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class ArchiveNested {
  Integer textureCount;
  Integer size;
  String type;
  Integer textureMaxResolution;
  Integer faceCount;
  Integer vertexCount;
}
