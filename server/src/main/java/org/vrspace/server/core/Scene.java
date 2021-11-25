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

  @SuppressWarnings("static-access")
  private static Set<VRObject> newScene() {
    return new ConcurrentHashMap<VRObject, ID>().newKeySet();
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

        sendRemove(remove);
        sendAdd(add);

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

  private boolean isInRange(VRObject o) {
    return o.getPosition() == null
        || (o.getPosition().getX() == 0 && o.getPosition().getY() == 0 && o.getPosition().getZ() == 0)
        || (o.getPosition().isInRange(client.getPosition(), props.getRange()));
  }

  /**
   * Offer an object to the scene. Accepted new objects in range and visible
   * (passing all filters). Objects without positions, or with zero positions are
   * also accepted, so that new objects become immediately visible. If accepted,
   * sends Add command to the client.
   * 
   * @param o
   */

  public void offer(VRObject o) {
    if (!members.contains(o) && isInRange(o) && isVisible(o)) {
      // add to the scene
      members.add(o);
      // register listener
      add(o);
      // notify the client
      Add add = new Add().addObject(o);
      sendAdd(add);
    }
  }

  /**
   * Offer object(s) to the scene. Sends out only one Add command with accepted
   * objects.
   * 
   * @param objects
   * @see #offer(VRObject)
   */
  public void offer(Collection<VRObject> objects) {
    Add add = new Add();
    for (VRObject o : objects) {
      log.debug("Client " + client.getId() + " offered " + o.getId() + " inRange:" + isInRange(o) + " visible:"
          + isVisible(o) + " contains:" + members.contains(o));
      if (!members.contains(o) && isInRange(o) && isVisible(o)) {
        // add to the scene
        members.add(o);
        add(o);
        add.addObject(o);
      }
    }
    // notify the client
    sendAdd(add);
  }

  /**
   * Offer some object(s) to scenes of all listeners. E.g. a new object just added
   * to the space, or client just logged in (starting the session), or entering a
   * new space.
   * 
   * @param objects
   * @see #offer(Collection)
   */
  public void publishAll(Collection<VRObject> objects) {
    offer(objects);
    members.stream().filter(o -> o instanceof Client).forEach(o -> {
      Client c = (Client) o;
      if (c.getScene() != null) {
        c.getScene().offer(objects);
      }
    });
  }

  /**
   * Publish an object - notify all clients in range
   * 
   * @param obj
   * @see #offer(VRObject)
   */
  public void publish(VRObject obj) {
    offer(obj);
    members.stream().filter(o -> o instanceof Client).forEach(o -> {
      Client c = (Client) o;
      if (c.getScene() != null) {
        c.getScene().offer(obj);
      }
    });
  }

  /**
   * Remove objects and notify all clients they are removed.
   * 
   * @param objects
   */
  public void unpublish(Collection<VRObject> objects) {
    Remove remove = new Remove();
    for (VRObject obj : objects) {
      remove(remove, obj);
    }
    members.stream().filter(o -> o instanceof Client).forEach(o -> {
      Client c = (Client) o;
      if (c.getScene() != null) {
        Remove r = new Remove();
        for (VRObject obj : objects) {
          c.getScene().remove(r, obj);
        }
        c.getScene().sendRemove(r);
      }
    });
    sendRemove(remove);
  }

  /**
   * Notification that a client has logged out - removes it from the scene and
   * sends Remove message.
   * 
   * @param c
   */
  public void logout(Client c) {
    if (members.contains(c)) {
      // notify the client
      Remove remove = remove(new Remove(), c);
      sendRemove(remove);
    }
  }

  /**
   * Unpublish this client - notifies all clients in the range that it has logged
   * out.
   * 
   * @see #logout(Client)
   */
  public void unpublish() {
    members.stream().filter(o -> o instanceof Client).forEach(o -> {
      Client c = (Client) o;
      if (c.getScene() != null) {
        c.getScene().logout(client);
      }
    });
  }

  /**
   * Ensure the scene will be updated on next update() call.
   */
  public void setDirty() {
    lastUpdate = 0;
  }

  /**
   * Remove an object from the scene
   * 
   * @param remove Remove command to collect removed object
   * @param t      object to remove
   * @return remove argument containing removed object
   */
  private Remove remove(Remove remove, VRObject t) {
    if (members.contains(t) || allObjects.containsKey(t.getObjectId())) {
      // recursive remove children
      if (t.getChildren() != null) {
        t.getChildren().forEach(obj -> remove(remove, obj));
      }
      remove.removeObject(t);
      // if (t.isActive()) {
      t.removeListener(client);
      // }
      allObjects.remove(t.getObjectId());
      members.remove(t);
    }
    return remove;
  }

  /**
   * Remove all objects from the scene, and stop listening to changes. Next call
   * to update() will reestablish the event model, and may cause sending removal
   * messages to the client.
   */
  public void removeAll() {
    Remove remove = new Remove();
    try {
      for (VRObject t : members) {
        remove(remove, t);
      }
      sendRemove(remove);
      setDirty();
    } catch (Throwable e) {
      log.error("Error during removal", e);
    }
  }

  private void sendRemove(Remove remove) {
    log.debug("Scene for " + client.getId() + " removing " + remove.getObjects().size());
    if (remove.getObjects().size() > 0) {
      client.sendMessage(remove);
    }
  }

  private void sendAdd(Add add) {
    log.debug("Scene for " + client.getId() + " adding " + add.getObjects().size());
    if (add.getObjects().size() > 0) {
      client.sendMessage(add);
    }
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
