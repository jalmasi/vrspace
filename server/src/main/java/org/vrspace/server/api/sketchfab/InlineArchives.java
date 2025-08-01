package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class InlineArchives {
  ArchiveNested source;
  ArchiveNested glb;
  ArchiveNested usdz;
  ArchiveNested gltf;
}

