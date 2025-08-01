package org.vrspace.server.api.sketchfab;

import java.util.List;

import lombok.Data;
import lombok.EqualsAndHashCode;

/** Model search response, returned as received from sketchfab */
@Data
@EqualsAndHashCode(callSuper = true)
public class ModelSearchResponse extends Pagination {
  List<ModelSearchList> results;
}
