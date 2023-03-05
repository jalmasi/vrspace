package org.vrspace.server.obj;

import java.util.Set;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonMerge;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * Shared dynamic terrain, work in progress. Saving terrain with hundreds of
 * points changed can easily take a few seconds.
 * 
 * @author joe
 *
 */
@Data
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class Terrain extends VRObject {
  private Color diffuseColor;
  private Color emissiveColor;
  private Color specularColor;
  private String diffuseTexture;

  /** Transient property, used only to propagate changes to other clients */
  @Transient
  transient volatile private TerrainChange change;

  @JsonMerge
  // @Relationship(type = "HAS_POINT", direction =
  // Relationship.Direction.INCOMING)
  @Transient
  private Set<TerrainPoint> points;

  @Data
  public static class TerrainChange {
    private long index;
    private Point point;
  }
}