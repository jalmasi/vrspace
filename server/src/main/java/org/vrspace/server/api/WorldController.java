package org.vrspace.server.api;

import java.util.List;
import java.util.UUID;

import javax.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.WorldStatus;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

import lombok.extern.slf4j.Slf4j;

/**
 * World controller handles worlds-related operations. Currently only list and
 * count users, publicly available. Eventually it should allow world creation
 * and management for authorised users.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(WorldController.PATH)
public class WorldController extends ApiBase {
  public static final String PATH = API_ROOT + "/worlds";

  @Autowired
  private VRObjectRepository db;
  @Autowired
  private ClientFactory clientFactory;
  @Autowired
  private WorldManager manager;

  @GetMapping("/list")
  public List<World> list() {
    List<World> worlds = db.listWorlds();
    log.debug("Worlds: " + worlds);
    return worlds;
  }

  // CHECKME this returns all Clients rather than just users, more methods are
  // required, or more info in WorldStatus DTO
  @GetMapping("/users")
  public List<WorldStatus> users() {
    List<WorldStatus> stats = db.countUsers();
    log.debug("Stats: " + stats);
    return stats;
  }

  /**
   * Create a private world, the user must be authenticated. If the world already
   * exists, owner may change isPublic or isTemporary parameters. Returns HTTP 201
   * CREATED for created world, or HTTP 200 OK if world already exists.
   * 
   * @param session           automatically passed by framework
   * @param worldName         world name of created world, must be unique
   * @param templateWorldName optional world template to use
   * @param isPublic          optional flag to create public or private world,
   *                          default false
   * @param isTemporary       optional flag to create a temporary world, default
   *                          true
   * @return token required to enter the world, only for private worlds
   */
  @PostMapping("/create")
  // CHECKME: DTO or request params?
  public ResponseEntity<String> createWorld(HttpSession session, @RequestParam(required = true) String worldName,
      String templateWorldName, boolean isPublic, boolean isTemporary) {
    String userName = currentUserName(session, clientFactory);
    if (userName == null) {
      throw new SecurityException("User must be logged in");
    }
    Client user = manager.getClientByName(userName);
    if (user == null) {
      // CHECKME this should never happen - user must exist both in session and the
      // database at all times
      throw new SecurityException("User " + userName + " must be logged in");
    }
    if (worldName == null) {
      // TODO test this
      throw new ApiException("World name must be specified");
    }
    World world = db.getWorldByName(worldName);
    if (world == null) {
      world = new World();
      if (templateWorldName != null) {
        // World template = manager.getWorld(templateWorldName);
        // if (template == null) {
        // this is fine, so no objects to copy
        // throw new ApiException("World template " + templateWorldName + " not found");
        // }
        // this won't do anything useful
        // BeanUtils.copyProperties(template, world);
        // TODO copy existing objects to a new world
      }
      world.setName(worldName);
      world.setOwner(user);
      world.setDefaultWorld(false);
      world.setPublicWorld(isPublic);
      world.setTemporaryWorld(isTemporary);
      if (!isPublic) {
        world.setToken(UUID.randomUUID().toString());
      }
      world = manager.saveWorld(world);
      log.info("World " + worldName + " created by user " + userName + " token: " + world.getToken());
      return new ResponseEntity<>(world.getToken(), HttpStatus.CREATED);
    } else {
      world = db.get(World.class, world.getId());
      if (!user.equals(world.getOwner())) {
        // TODO test this
        throw new SecurityException("User " + userName + " does not own exiting world " + worldName);
      }
      world.setPublicWorld(isPublic);
      world.setTemporaryWorld(isTemporary);
      if (isPublic) {
        world.setToken(null);
      } else {
        world.setToken(UUID.randomUUID().toString());
      }
      log.info("World " + worldName + " updated by user " + userName + " token: " + world.getToken());
      return new ResponseEntity<>(world.getToken(), HttpStatus.OK);
    }
  }
}
