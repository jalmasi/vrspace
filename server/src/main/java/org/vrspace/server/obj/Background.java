package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * Properties of world background, e.g. skybox or panoramic image, and the
 * enviroment.
 */
@Data
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
public class Background extends VRObject {
  private String texture;
  private String ambientIntensity;
}
