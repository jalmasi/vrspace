package org.vrspace.server.connect.sketchfab;

import lombok.Data;

@Data
public class Pagination {
  String next;
  String previous;
  Cursors cursors;
}
