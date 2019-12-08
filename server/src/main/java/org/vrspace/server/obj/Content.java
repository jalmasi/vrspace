package org.vrspace.server.obj;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Content {
  private String fileName;
  private String contentType;
  private long length;
}
