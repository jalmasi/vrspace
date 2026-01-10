package org.vrspace.server.connect.sketchfab;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class FileInfo {
  private String url;
  private long size;
  private int expires;
}
