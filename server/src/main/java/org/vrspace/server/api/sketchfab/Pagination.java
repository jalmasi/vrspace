package org.vrspace.server.api.sketchfab;

import lombok.Data;

@Data
public class Pagination {
  String next;
  String previous;
  Cursors cursors;
}
