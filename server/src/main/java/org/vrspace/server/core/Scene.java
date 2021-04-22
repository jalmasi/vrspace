package org.vrspace.server.core;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.Filter;
import org.vrspace.server.types.ID;

import lombok.extern.slf4j.Slf4j;

/**
 * This keeps track of objects visible to the Client. This scene uses
 * coordinates to determine which objects are in range. Scene is updated when
 * client moves more than resolution meters, or when timeout occurs.
 */
@Slf4j
public class Scene {
  private Point oldPos = new Point();

  private Set<VRObject> members = newScene(); // non-permanent transforms
  private HashMap<ID, VRObject> allObjects = new HashMap<ID, VRObject>(); // all objects in the world

  private WorldManager world;
  private Client client;

  private long lastUpdate = 0;
  private boolean active = false;

  protected SceneProperties props;

  private LinkedHashMap<String, Filter> filters = new LinkedHashMap<String, Filter>();

  protected Scene() {
  }

  private static Set<VRObject> newScene() {
    return new ConcurrentHashMap<ID, VRObject>().newKeySet();
  }

  /**
   * Creates new Scene for Client client
   */
  public Scene(WorldManager world, Client client) {
    this.world = world;
    this.client = client;
    this.props = client.getSceneProperties();
  }

  public int size() {
    return members.size();
  }

  /**
   * Update the scene current client's coordinates.
   */
  public void update() {
    try {
      // CHECKME this shouldn't get called by anyone except the client
      if (active) {
        return;
      }
      active = true;
      if (!client.getPosition().isInRange(oldPos, props.getResolution())
          || System.currentTimeMillis() > lastUpdate + props.getTimeout()) {

        Set<VRObject> newScene = newScene();
        // Check region
        Point p1 = new Point(client.getPosition()).minus(props.getRange());
        Point p2 = new Point(client.getPosition()).plus(props.getRange());
        Set<VRObject> objects = world.getRange(client, p1, p2);

        Add add = new Add();
        Remove remove = new Remove();

        // just in case db doesn't return range properly:
        // && t.getPosition() != null && t.getPosition().isInRange(x, y, z,
        // props.getRange())
        objects.stream().filter(t -> isVisible(t)).forEach(t -> {
          if (members.contains(t)) {
            // already in scene
            members.remove(t);
            newScene.add(t);
          } else {
            add(t); // adds children and listeners
            newScene.add(t);
            add.addObject(t);
          }
          // else empty transform, or children filtered out
        });

        // now members contains only invisible objects
        // remove them from the scene, and from vrobject set
        members.forEach(t -> remove(remove, t));

        if (remove.getObjects().size() > 0) {
          log.debug("Scene for " + client.getId() + " removing " + remove.getObjects().size());
          client.sendMessage(remove);
        }
        if (add.getObjects().size() > 0) {
          log.debug("Scene for " + client.getId() + " adding " + add.getObjects().size());
          client.sendMessage(add);
        }

        oldPos.copy(client.getPosition());

        // build up new scene
        members = newScene;
        lastUpdate = System.currentTimeMillis();
      }
    } catch (Exception e) {
      log.error("Scene for " + client, e);
      throw (e);
    }
    active = false;
  }

  private void add(VRObject t) {
    if (t.getChildren() != null) {
      for (VRObject obj : t.getChildren()) {
        // package filter implementation
        if (isVisible(obj)) {
          add(obj);
        }
      }
    }
    if (t.isActive()) {
      t.addListener(client);
    }
    allObjects.put(new ID(t), t);
  }

  /**
   * Offer an object to the scene. Accepted new objects in range and visible
   * (passing all filters)
   * 
   * @param o
   */

  public void offer(VRObject o) {
    if (!members.contains(o) && (o.getPosition() != null && o.getPosition().isInRange(oldPos, props.getResolution()))
        && isVisible(o)) {
      // add to the scene
      members.add(o);
      // notify the client
      Add add = new Add().addObject(o);
      client.sendMessage(add);
    }
  }

  public void offer(Collection<VRObject> objects) {
    Add add = new Add();
    for (VRObject o : objects) {
      if (!members.contains(o) && (o.getPosition() != null && o.getPosition().isInRange(oldPos, props.getResolution()))
          && isVisible(o)) {
        // add to the scene
        members.add(o);
        add(o);
        add.addObject(o);
      }
    }
    // notify the client
    if (add.getObjects().size() > 0) {
      client.sendMessage(add);
    }
  }

  /**
   * Offer some object(s) to scenes of all listeners. E.g. a new object just added
   * to the space, or client just logged in (starting the session), or entering a
   * new space.
   * 
   * @param objects
   */
  public void publishAll(Collection<VRObject> objects) {
    offer(objects);
    members.stream().filter(o -> o instanceof Client).forEach(o -> {
      Client c = (Client) o;
      c.getScene().offer(objects);
    });
  }

  public void publish(VRObject obj) {
    offer(obj);
    members.stream().filter(o -> o instanceof Client).forEach(o -> {
      Client c = (Client) o;
      if (c.getScene() != null) {
        c.getScene().offer(obj);
      }
    });
  }

  private void remove(Remove remove, VRObject t) {
    // recursive remove children
    if (t.getChildren() != null) {
      t.getChildren().forEach(obj -> remove(remove, obj));
    }
    remove.removeObject(t);
    // if (t.isActive()) {
    t.removeListener(client);
    // }
    allObjects.remove(new ID(t));
  }

  /**
   * Ensure the scene will be updated on next update() call.
   */
  public void setDirty() {
    lastUpdate = 0;
  }

  /**
   * Removes an object from the scene. Next update() may add it again.
   */
  public void remove(VRObject t) throws Exception {
    remove(t, true);
  }

  /**
   * Removes an object from the scene.
   * 
   * @param removeReference specifies whether object reference is to be removed
   *                        internally, and this influences what happens during
   *                        next update(): If the reference is kept and object is
   *                        in range, nothing will happen, but if reference is
   *                        removed, object will be re-added. If reference is
   *                        removed, and object is not in range, it will be
   *                        removed during next update().
   */
  public void remove(VRObject t, boolean removeReference) throws Exception {
    Remove remove = new Remove();
    remove(remove, t);

    // Remove the object from the lists.
    if (removeReference) {
      members.remove(t);
    }
  }

  private void clear(boolean force) {
    try {
      // FIXME java.util.ConcurrentModificationException: null
      for (VRObject t : members) {
        remove(t, force);
      }
      setDirty();
    } catch (Throwable e) {
      log.error("Error during removal", e);
    }
  }

  /**
   * Force reload of the scene: remove all objects from the scene. Next call to
   * update() will cause remove/add messages to be sent.
   */
  public void reload() {
    clear(true);
  }

  /**
   * Remove all objects from the scene, and stop listening to changes. Next call
   * to update() will reestablish the event model, and may cause sending removal
   * messages to the client.
   */
  public void removeAll() {
    clear(false);
  }

  /**
   * Test Transform against set of filters. Client's transform don't pass the
   * test.
   * 
   */
  protected boolean isVisible(VRObject o) {
    return !o.isPermanent() && !o.equals(client) && filters.values().stream().allMatch(f -> f.apply(o));
  }

  /**
   * Retrieve an object in the scene FIXME used only in tests?
   */
  public VRObject get(ID id) {
    return allObjects.get(id);
  }

  /**
   * Returns the closest Transform to the specified point
   * 
   * @throws NoSuchElementException if scene is empty
   */
  public VRObject getClosest(double x, double y, double z) {
    Optional<VRObject> closestMember = members.stream()
        .min(Comparator.comparing(t -> t.getPosition().getDistance(x, y, z)));
    return closestMember.get();
  }

  /**
   * Returns transforms within the range Does not return permanent objects TODO:
   * check bounding boxes
   */
  public List<VRObject> get(double x, double y, double z, double range) {
    return members.stream().filter(t -> t.getPosition().isInRange(x, y, z, range)).collect(Collectors.toList());
  }

  public void addFilter(String name, Filter filter) {
    filters.put(name, filter);
    setDirty();
  }

  public void removeFilter(String name) {
    filters.remove(name);
    setDirty();
  }
}
