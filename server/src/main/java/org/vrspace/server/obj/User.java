package org.vrspace.server.obj;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.types.Filter;
import org.vrspace.server.types.Owned;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@Owned
@Slf4j
public class User extends Client {
  /** Does this client have humanoid avatar, default true */
  private boolean isHumanoid = true;
  /**
   * Left arm position, used in VR. Transient biometric data.
   */
  @Transient
  transient private Point leftArmPos;
  /**
   * Right arm position, used in VR. Transient biometric data.
   */
  @Transient
  transient private Point rightArmPos;
  /**
   * Left arm rotation, used in VR. Transient biometric data.
   */
  @Transient
  transient private Quaternion leftArmRot;
  /**
   * Right arm rotation, used in VR. Transient biometric data.
   */
  @Transient
  transient private Quaternion rightArmRot;

  @Override
  public void createScene(WorldManager wm) {
    // create scene, TODO: scene filters
    Scene scene = new Scene(wm, this);
    scene.addFilter("removeOfflineClients", Filter.removeOfflineClients());
    setScene(scene);
    scene.update();
    scene.publish(this);
  }
}
