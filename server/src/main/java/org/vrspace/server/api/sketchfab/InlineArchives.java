package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class InlineArchives {
  ArchiveNested glb;
  ArchiveNested gltf;
  ArchiveNested source;
  ArchiveNested usdz;
}
