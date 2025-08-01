package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class ArchiveNested {
  Integer faceCount;
  Integer textureCount;
  Integer size;
  Integer vertexCount;
  Integer textureMaxResolution;
}
