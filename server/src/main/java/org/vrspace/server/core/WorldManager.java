package org.vrspace.server.core;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.neo4j.ogm.session.Session;
import org.neo4j.ogm.session.SessionFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;
import org.vrspace.server.types.Filter;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.openvidu.java.client.OpenViduException;
import lombok.extern.slf4j.Slf4j;

/**
 * Main component that manages all interactions with virtual worlds.
 * 
 * @author joe
 *
 */
@Component("world")
@Slf4j
public class WorldManager {

  @Autowired
  protected ServerConfig config; // used in tests

  @Autowired
  private VRObjectRepository db;

  @Autowired
  protected SceneProperties sceneProperties; // used in tests

  @Autowired
  private ObjectMapper jackson;

  @Autowired
  private Session session;

  @Autowired
  private SessionFactory sessionFactory;

  @Autowired
  private StreamManager streamManager;

  private Dispatcher dispatcher;

  protected SessionTracker sessionTracker;

  // used in tests
  protected ConcurrentHashMap<ID, VRObject> cache = new ConcurrentHashMap<ID, VRObject>();

  private World defaultWorld;

  @PostConstruct
  public void init() {
    this.dispatcher = new Dispatcher(jackson);
    this.sessionTracker = new SessionTracker(config);
  }

  // CHECKME: should this be here?
  public List<Class<?>> listClasses() {
    // gotta love oneliners :)
    return sessionFactory.metaData().persistentEntities().stream()
        .filter(info -> !info.isAbstract() && Entity.class.isAssignableFrom(info.getUnderlyingClass()))
        .map(i -> i.getUnderlyingClass()).collect(Collectors.toList());
  }

  public Set<VRObject> getPermanents(Client client) {
    return db.getPermanents(client.getWorld().getId());
  }

  public World getWorld(String name) {
    return db.getWorldByName(name);
  }

  public Client getClientByName(String name) {
    Client ret = db.getClientByName(name);
    return (Client) updateCache(ret);
  }

  public <T extends VRObject> T save(T obj) {
    T ret = db.save(obj);
    cache.put(new ID(obj), ret);
    return ret;
  }

  public Set<VRObject> getRange(Client client, Point from, Point to) {
    // CHECKME: what to do with client here?
    HashSet<VRObject> ret = new HashSet<VRObject>();
    // takes typically 10 ms
    Set<VRObject> inRange = db.getRange(client.getWorld().getId(), from, to);
    for (VRObject o : inRange) {
      ret.add(updateCache(o));
    }
    return ret;
  }

  private VRObject updateCache(VRObject o) {
    // CHECKME: should this be null safe?
    if (o != null) {
      ID id = new ID(o);
      VRObject cached = cache.get(id);
      if (cached != null) {
        return cached;
      } else {
        // FIXME: hard coded depth
        session.load(o.getClass(), o.getId(), 2);
        cache.put(id, o);
        return o;
      }
    }
    return null;
  }

  /**
   * Add objects to client's current position
   * 
   * @param client  client adding objects
   * @param objects objects to add
   * @return list of added objects
   */
  public List<VRObject> add(Client client, List<VRObject> objects) {
    List<VRObject> ret = objects.stream().map(o -> {
      if (o.getPosition() == null && client.getPosition() != null) {
        o.setPosition(new Point(client.getPosition()));
      }
      o.setWorld(client.getWorld());
      o.setTemporary(client.isGuest());
      o = db.save(o);
      client.addOwned(o);
      cache.put(o.getObjectId(), o);
      return o;
    }).collect(Collectors.toList());
    db.save(client);
    return ret;
  }

  public void remove(Client client, VRObject obj) {
    ID objId = obj.getObjectId();
    // CHECKME: remove invisible objects?
    if (!client.isOwner(obj)) {
      throw new SecurityException("Not yours to remove");
    }
    cache.remove(objId);
    db.delete(obj);
    client.removeOwned(obj);
    db.save(client);
  }

  @Transactional
  public Welcome login(WebSocketSession session) {
    Client client = null;
    if (!config.isGuestAllowed() && session.getPrincipal() == null) {
      throw new SecurityException("Unauthorized");
    }
    if (session.getPrincipal() != null) {
      client = db.getClientByName(session.getPrincipal().getName());
      if (client == null) {
        throw new SecurityException("Unauthorized " + session.getPrincipal().getName());
      }
      client.setSession(session);
    } else if (config.isGuestAllowed()) {
      // TODO: introduce ClientFactory
      client = new Client(session);
      client.setPosition(new Point());
      client.setGuest(true);
      client = db.save(client);
    }
    client.setMapper(jackson);
    client.setSceneProperties(sceneProperties.newInstance());
    cache.put(new ID(client), client);

    return enter(client, defaultWorld());
  }

  public World defaultWorld() {
    if (defaultWorld == null) {
      synchronized (this) {
        defaultWorld = db.getWorldByName("default");
        if (defaultWorld == null) {
          defaultWorld = db.save(new World("default", true));
          log.info("Created default world: " + defaultWorld);
        }
      }
    }
    return defaultWorld;
  }

  public Welcome enter(Client client, String worldName) {
    World world = getWorld(worldName);
    if (world == null) {
      if (config.isCreateWorlds()) {
        world = db.save(new World(worldName));
      } else {
        throw new IllegalArgumentException("Unknown world: " + worldName);
      }
    }
    return enter(client, world);
  }

  public Welcome enter(Client client, World world) {
    if (client.getWorld() != null) {
      if (client.getWorld().equals(world)) {
        throw new IllegalArgumentException("Already in world " + world);
      }
      // exit current world first
      exit(client);
    }
    // create audio stream
    streamManager.join(client, world);

    // client has now entered the world
    client.setWorld(world);
    // client.setActive(true); // DON'T
    client = save(client);

    Welcome ret = new Welcome(client, getPermanents(client));
    return ret;
  }

  public void startSession(Client client) {
    sessionTracker.addSession(client);

    // client has now entered the world
    client.setActive(true);
    client = save(client);

    // create scene, TODO: scene filters
    Scene scene = new Scene(this, client);
    scene.addFilter("removeOfflineClients", Filter.removeOfflineClients());
    client.setScene(scene);
    scene.update();
    scene.publish(client);
  }

  @Transactional
  public void logout(Client client) {
    sessionTracker.remove(client);
    exit(client);
    // delete guest client
    if (client.isGuest()) {
      if (client.getOwned() != null) {
        for (VRObject owned : client.getOwned()) {
          if (owned.isTemporary()) {
            cache.remove(owned.getObjectId());
            db.delete(owned);
            log.debug("Deleted owned temporary " + owned.getObjectId());
          }
        }
      }
      cache.remove(new ID(client));
      db.delete(client);
      log.debug("Deleted guest client " + client.getId());
    }

  }

  private void exit(Client client) {
    // notify all listeners that the client disconnected
    client.setActive(false);
    // TODO introduce LoginEvent
    VREvent ev = new VREvent(client, client);
    ev.addChange("active", false);
    client.notifyListeners(ev);
    if (client.getScene() != null) {
      // remove client from all scenes
      client.getScene().unpublish();
      // clear the scene to stop receiving events
      client.getScene().removeAll();
    }
    client.setListeners(null);
    // also remove the client from streaming session
    try {
      streamManager.disconnect(client);
    } catch (OpenViduException e) {
      log.error("Error disconnecting client " + client + " from streaming session", e);
    }
    // remove client from the world
    client.setWorld(null);
    client = save(client);
  }

  @Transactional
  public void dispatch(VREvent event) throws Exception {
    Client client = event.getClient();
    if (client == null) {
      throw new IllegalArgumentException("Event from uknown client " + event);
    }
    Scene scene = client.getScene();
    if (event instanceof ClientRequest && ((ClientRequest) event).isCommand()) {
      Command cmd = ((ClientRequest) event).getCommand();
      Object ret = cmd.execute(this, client);
      if (ret != null) {
        // synchronous command, send response
        client.sendMessage(ret);
      }
    } else {
      if (event.sourceIs(client)) {
        event.setSource(client);
      } else {
        if (scene == null) {
          throw new UnsupportedOperationException("Client has no scene " + client);
        }
        VRObject obj = scene.get(event.getSourceID());
        if (obj == null) {
          // TODO: scene could not find object - this should be allowed for admin
          throw new UnsupportedOperationException("Object not found in the scene: " + event.getSourceID());
        } else {
          event.setSource(obj);
        }
      }
      dispatcher.dispatch(event);
      // TODO: some kind of write back cache
      // takes typically 10 ms
      long time = System.currentTimeMillis();
      db.save(event.getSource());
      log.debug(new ID(event.getSource()) + " saved in " + (System.currentTimeMillis() - time) + " ms");
    }
    if (scene != null) {
      scene.update();
    }
  }

}
