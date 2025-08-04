package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Interact with the current world: add, remove, and change basic properties of
 * VRObject instances. Instances of VRObject subclasses (e.g. User, Terrain)
 * cannot be accessed this way. To be removed or changed, the object must be
 * owned, and present in the scene (i.e. visible).
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(WorldObjects.PATH)
public class WorldObjects extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/world";
  private static String CLASS = "VRObject";
  @Autowired
  private WorldManager worldManager;
  @Autowired
  private VRObjectRepository db;

  /**
   * Add a shared object to the world, equivalent of websocket Add command. Once
   * created, the object is immediately published, i.e. pushed to all clients,
   * including the creator, through websockets. Unlike Add command, that can be
   * used to create world objects of any class, e.g. Terrain, this can only create
   * VRObject class instances.
   * 
   * @param obj VRObject to create, must not have an id
   * @return the created VRObject, including the id
   */
  @PutMapping("/add")
  public VRObject addObject(HttpSession session, @RequestBody VRObject obj) {
    Client client = findClient(session, db);
    VRObject ret = worldManager.add(client, obj);
    client.getScene().publish(ret);
    return ret;
  }

  /**
   * Remove a shared VRObject.
   * 
   * @param id object id
   */
  @DeleteMapping("/remove")
  public void removeObject(HttpSession session, Long id) {
    Client client = findClient(session, db);
    VRObject obj = client.getScene().get(new ID(CLASS, id));
    if (obj != null) {
      worldManager.remove(client, obj);
      client.getScene().unpublish(obj);
    }
  }

  /**
   * Change position, rotation and/or scale of an object. All other object
   * properties are ignored.
   * 
   */
  @PatchMapping("/coordinates")
  public void objectCoordinates(HttpSession session, @RequestBody VRObject changes) {
    Client client = findClient(session, db);
    VRObject obj = client.getScene().get(new ID(CLASS, changes.getId()));
    if (obj == null) {
      throw new IllegalArgumentException("Object not in the scene");
    }
    ClientRequest req = new ClientRequest(obj);
    req.setClient(client);

    if (changes.getPosition() != null) {
      req.addChange("position", changes.getPosition());
    }
    if (changes.getRotation() != null) {
      req.addChange("rotation", changes.getRotation());
    }
    if (changes.getScale() != null) {
      req.addChange("scale", changes.getScale());
    }

    try {
      worldManager.dispatch(req);
    } catch (RuntimeException e) {
      throw e;
    } catch (Exception e) {
      log.error("Internal error", e);
    }
  }
}
