package org.vrspace.server.api.sketchfab;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class DownloadResponse {
  private FileInfo gltf;
  private FileInfo usdz;
}

