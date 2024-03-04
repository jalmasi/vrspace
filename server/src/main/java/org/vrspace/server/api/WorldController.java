package org.vrspace.server.api;

import java.util.List;

import javax.servlet.http.HttpSession;

import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
   * Create a world, user must be authenticated
   * 
   * @param session           automatically passed by framework
   * @param worldName         optional world name of created world, must be unique
   * @param templateWorldName optional world template to use
   */
  @PostMapping("/create")
  public void createWorld(HttpSession session, String worldName, String templateWorldName) {
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
    World world = new World();
    if (templateWorldName != null) {
      World template = manager.getWorld(templateWorldName);
      if (template == null) {
        throw new ApiException("World template " + templateWorldName + " not found");
      }
      BeanUtils.copyProperties(template, world);
    }
    world.setOwner(user);
    manager.saveWorld(world);
  }
}
