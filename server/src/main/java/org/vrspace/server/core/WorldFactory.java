package org.vrspace.server.core;

import java.util.Map;

import org.springframework.beans.BeanUtils;
import org.vrspace.server.config.WorldConfig;
import org.vrspace.server.config.WorldConfig.WorldProperties;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.World;
import org.vrspace.server.types.ID;

import lombok.extern.slf4j.Slf4j;

/**
 * Class responsible for world creation
 * 
 * @author joe
 *
 */
@Slf4j
public class WorldFactory {
  private WorldConfig worldConfig;
  private VRObjectRepository db;
  private Map<ID, Entity> cache;
  private WorldManager worldManager;

  private World defaultWorld;

  public WorldFactory(WorldManager worldManager) {
    this.worldConfig = worldManager.worldConfig;
    this.db = worldManager.getDb();
    this.cache = worldManager.cache;
    this.worldManager = worldManager;
  }

  /**
   * Create all worlds defined in properties file, default world is created first.
   */
  public void createWorlds() {
    defaultWorld();
    for (String worldName : worldConfig.worldNames()) {
      WorldProperties wp = worldConfig.getWorld().get(worldName);
      log.info("Configuring world: " + worldName);
      World world = worldManager.getWorld(worldName);
      try {
        if (world == null) {
          log.info("World " + worldName + " to be created as " + wp);
          String className = wp.getType();
          if (!className.contains(".")) {
            // using default package
            className = "org.vrspace.server.obj." + className;
          }
          Class<?> c = Class.forName(className);
          world = (World) c.getDeclaredConstructor().newInstance();
        } else {
          log.info("World " + worldName + " already exists : " + world);
        }
        BeanUtils.copyProperties(wp, world);
        db.save(world);
      } catch (Exception e) {
        log.error("Error configuring world " + worldName, e);
      }
    }
    log.info("WorldManager ready");
  }

  /**
   * Get the default world. It is created if does not exist already.
   * 
   * @return
   */
  public World defaultWorld() {
    if (defaultWorld == null) {
      defaultWorld = worldManager.getWorld("default");
      if (defaultWorld == null) {
        defaultWorld = db.save(new World("default", true));
        cache.put(defaultWorld.getObjectId(), defaultWorld);
        log.info("Created default world: " + defaultWorld);
      }
    }
    return defaultWorld;
  }

  /**
   * Used to create worlds on demand. Synchronized to prevent race conditions.
   * 
   * @param name world name
   * @return new or existing world
   */
  protected synchronized World createWorld(String name) {
    // double-check, once again in synchronized block
    World world = worldManager.getWorld(name);
    if (world == null) {
      log.info("Creating temporary world on demand: " + name);
      world = new World(name);
      world.setTemporaryWorld(true);
      world = worldManager.saveWorld(world);
    }
    return world;
  }

}
