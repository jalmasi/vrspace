package org.vrspace.server.connect.sketchfab;

import lombok.Data;

@Data
public class InlineArchives {
  ArchiveNested glb;
  ArchiveNested gltf;
  ArchiveNested source;
  ArchiveNested usdz;
}
