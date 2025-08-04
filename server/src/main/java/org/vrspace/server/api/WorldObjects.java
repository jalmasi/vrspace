package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Interact with the current world.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(WorldObjects.PATH)
public class WorldObjects extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/world";
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
   * Remove a shared object.
   * 
   * @param className class of the object, e.g. VRObject
   * @param id        object id
   */
  @DeleteMapping("/remove")
  public void removeObject(HttpSession session, String className, Long id) {
    Client client = findClient(session, db);
    VRObject obj = client.getScene().get(new ID(className, id));
    if (obj != null) {
      worldManager.remove(client, obj);
      client.getScene().unpublish(obj);
    }
  }
}
