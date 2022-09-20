package org.vrspace.server.dto;

import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.Data;

/**
 * Scene properties that determine how far user sees, how often scene is
 * refreshed, etc. This is a component to be injected, and used as factory when
 * constructing Scene for every client.
 * 
 * @author joe
 *
 */
@Data
@Component
public class SceneProperties {
  /**
   * Visibility range, default 2000. Property: vrspace.scene.range
   */
  @Value("${vrspace.scene.range:2000}")
  private double range = 2000;
  /**
   * Resolution describes how far one can go before scene is updated, default 10.
   * Property: vrspace.scene.resolution
   */
  @Value("${vrspace.scene.resolution:10}")
  private double resolution = 10;
  /**
   * Maximum number of objects in the scene, default 1000. Property:
   * vrspace.scene.size
   */
  @Value("${vrspace.scene.size:1000}")
  private int size = 1000;
  /**
   * Scene is refreshed after this many milliseconds, default 30000. Property:
   * vrspace.scene.timeout
   */
  @Value("${vrspace.scene.timeout:30000}")
  private long timeout = 30000;

  public SceneProperties newInstance() {
    SceneProperties ret = new SceneProperties();
    BeanUtils.copyProperties(this, ret);
    return ret;
  }
}
