package org.vrspace.server.api;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.WorldStatus;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.World;

import jakarta.servlet.http.HttpSession;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.NonNull;
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
@RequestMapping(Worlds.PATH)
public class Worlds extends ApiBase {
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
   * World options
   */
  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  public static class CreateWorldOptions {
    @NonNull
    /** World name of created world, must be unique, required */
    private String worldName;
    /** Optional world template to use */
    private String templateName;
    /**
     * Optional UUID used as world token, required to enter private worlds, defaults
     * to a random UUID
     */
    private String token;
    /** Optional flag to create public or private world, default false */
    private boolean publicWorld;
    /** optional flag to create a temporary world, default true */
    private boolean temporaryWorld = true;
  }

  /**
   * Create a private world, the user must be authenticated. If the world already
   * exists, owner may change isPublic or isTemporary parameters. Returns HTTP 201
   * CREATED for created world, or HTTP 200 OK if world already exists.
   * 
   * @param session automatically passed by framework
   * @param params  world options
   * @return token required to enter the world, only for private worlds
   */
  @PostMapping("/create")
  // CHECKME: DTO or request params?
  public ResponseEntity<String> createWorld(HttpSession session,
      @RequestBody(required = true) CreateWorldOptions params) {
    String userName = currentUserName(session, clientFactory);
    log.debug("Create world, user: " + userName + " parms: " + params);
    if (userName == null) {
      throw new SecurityException("User must be logged in");
    }
    Client user = manager.getClientByName(userName);
    if (user == null) {
      // CHECKME this should never happen - user must exist both in session and the
      // database at all times
      throw new SecurityException("User " + userName + " must be logged in");
    }
    if (params.worldName == null) {
      // TODO test this
      throw new ApiException("World name must be specified");
    }
    UUID token = null;
    if (params.token == null) {
      token = UUID.randomUUID();
    } else {
      token = UUID.fromString(params.token);
    }
    World world = db.getWorldByName(params.worldName);
    if (world == null) {
      world = new World();
      if (params.templateName != null) {
        // World template = manager.getWorld(templateWorldName);
        // if (template == null) {
        // this is fine, so no objects to copy
        // throw new ApiException("World template " + templateWorldName + " not found");
        // }
        // this won't do anything useful
        // BeanUtils.copyProperties(template, world);
        // TODO copy existing objects to a new world
      }
      world.setName(params.worldName);
      world.setOwner(user);
      world.setDefaultWorld(false);
      world.setPublicWorld(params.publicWorld);
      world.setTemporaryWorld(params.temporaryWorld);
      if (!params.publicWorld) {
        world.setToken(token.toString());
      }
      world = manager.saveWorld(world);
      log.info("World " + params.worldName + " created by user " + userName + " token: " + world.getToken());
      return new ResponseEntity<>(world.getToken(), HttpStatus.CREATED);
    } else {
      world = db.get(World.class, world.getId());
      if (!user.equals(world.getOwner())) {
        // TODO test this
        throw new SecurityException("User " + userName + " does not own exiting world " + params.worldName);
      }
      world.setPublicWorld(params.publicWorld);
      world.setTemporaryWorld(params.temporaryWorld);
      if (params.publicWorld) {
        world.setToken(null);
      } else {
        world.setToken(token.toString());
      }
      log.info("World " + params.worldName + " updated by user " + userName + " token: " + world.getToken());
      return new ResponseEntity<>(world.getToken(), HttpStatus.OK);
    }
  }
}
