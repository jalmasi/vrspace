package org.vrspace.server.obj;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.core.WorldManager;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * VRObject container, contains isolated parts of space, like chat room. One default world is created on startup, others are
 * typically created on demand, after Enter command is issued.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@RequiredArgsConstructor
@JsonInclude(Include.NON_EMPTY)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true)
@Slf4j
public class World extends Entity {
  // @Index(unique = true) - NeoConfig creates it
  /** Unique world name */
  @NonNull
  private String name;
  /** Optional description of the world */
  private String description;
  /** Optional URL of world image displayed on the portal */
  private String thumbnail;
  /** There can be only one **/
  private boolean defaultWorld;
  /** Can all users enter the world */
  private boolean publicWorld = true;
  /** Temporary worlds are created on demand */
  private boolean temporaryWorld = false;
  @JsonIgnore
  @Transient
  private transient String token;
  @JsonIgnore
  private Client owner;

  public World(String name, boolean defaultWorld) {
    this.name = name;
    this.defaultWorld = defaultWorld;
  }

  /**
   * Called when client enters the world. It may change some client properties, allow entrance or not, etc. This implementation
   * checks whether the world is private and owned, and compares the session token.
   * 
   * @param c  Client that's asking to enter
   * @param wm WorldManager
   * @return true if client is allowed to enter
   */
  public boolean enter(Client c, WorldManager wm) {
    if (!publicWorld && getOwner() != null && !c.equals(this.getOwner())) {
      String serviceId = tokenName();
      // so the world is private, and the client is not the owner
      String token = c.getToken(serviceId);
      log.debug("Token for " + serviceId + ": " + this.getToken() + " Client offered: " + token);
      if (token == null) {
        return false;
      }
      // check if token in user's session matches
      return token.equals(this.getToken());
    }
    return true;
  }

  /**
   * Called after client exits the world. After the owner (if any) exits the world, invalidates the token (if any).
   * 
   * @param c  Client exiting the world
   * @param wm WorldManager
   */
  public void exit(Client c, WorldManager wm) {
    if (c.equals(getOwner())) {
      this.token = null;
    }
  }

  public String tokenName() {
    return this.getName();
  }
}
