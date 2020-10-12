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

@Component("world")
@Slf4j
public class WorldManager {

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

  private boolean guestAllowed = true;
  private boolean createWorlds = true;

  private ConcurrentHashMap<ID, VRObject> cache = new ConcurrentHashMap<ID, VRObject>();

  private World defaultWorld;

  @PostConstruct
  public void init() {
    this.dispatcher = new Dispatcher(jackson);
  }

  // CHECKME: should this be here?
  public List<Class<?>> listClasses() {
    // gotta love oneliners :)
    return sessionFactory.metaData().persistentEntities().stream()
        .filter(info -> !info.isAbstract() && Entity.class.isAssignableFrom(info.getUnderlyingClass()))
        .map(i -> i.getUnderlyingClass()).collect(Collectors.toList());
  }

  protected void setGuestAllowed(boolean allowed) {
    this.guestAllowed = allowed;
  }

  protected void setCreateWorlds(boolean allowed) {
    this.createWorlds = allowed;
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
   * @return list of identifiers of newly added objects
   */
  public List<ID> add(Client client, List<VRObject> objects) {
    List<ID> ret = objects.stream().map(o -> {
      if (o.getPosition() == null && client.getPosition() != null) {
        o.setPosition(new Point(client.getPosition()));
      }
      o.setWorld(client.getWorld());
      o = db.save(o);
      client.addOwned(o);
      ID id = new ID(o);
      cache.put(id, o);
      return id;
    }).collect(Collectors.toList());
    db.save(client);
    return ret;
  }

  public void remove(Client client, String cls, Long id) {
    ID objId = new ID(cls, id);
    VRObject obj = client.getScene().get(objId);
    // CHECKME: remove invisible objects?
    if (!client.isOwner(obj)) {
      throw new SecurityException("Not yours to remove");
    }
    cache.remove(objId);
    db.deleteById(id);
    client.removeOwned(obj);
    db.save(client);
  }

  @Transactional
  public Welcome login(WebSocketSession session) {
    Client client = null;
    if (!guestAllowed && session.getPrincipal() == null) {
      throw new SecurityException("Unauthorized");
    }
    if (session.getPrincipal() != null) {
      client = db.getClientByName(session.getPrincipal().getName());
      if (client == null) {
        throw new SecurityException("Unauthorized " + session.getPrincipal().getName());
      }
      client.setSession(session);
    } else if (guestAllowed) {
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
      if (createWorlds) {
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
    client.setActive(true);
    client = save(client);

    // create scene, TODO: scene filters
    Scene scene = new Scene(this, client);
    scene.addFilter("removeOfflineClients", Filter.removeOfflineClients());
    client.setScene(scene);

    Welcome ret = new Welcome(client, getPermanents(client));
    return ret;
  }

  @Transactional
  public void logout(Client client) {
    exit(client);
    // delete guest client
    if (client.isGuest()) {
      cache.remove(new ID(client));
      db.delete(client);
      log.debug("Deleted guest client " + client.getId());
    }
  }

  private void exit(Client client) {
    // first clear the scene, so other active objects (clients) don't keep reference
    // to the client and send it events
    if (client.getScene() != null) {
      client.getScene().removeAll();
      // shouldn't do that, causes bogus exception
      // but without it, we may load avatars twice!
      // seems that call to db.getRange() in the default world is important
      client.getScene().update();
      // causes async event processing issues
      // client.setScene(null);
    }
    // then notify all listeners that the client disconnected
    client.setActive(false);
    VREvent ev = new VREvent(client, client);
    ev.addChange("active", false);
    client.notifyListeners(ev);
    client.setListeners(null);
    // remove client from the world
    client.setWorld(null);
    client = save(client);
    // also remove the client from streaming session
    try {
      streamManager.disconnect(client);
    } catch (OpenViduException e) {
      log.error("Error disconnecting client " + client + " from streaming session", e);
    }
  }

  @Transactional
  public void dispatch(VREvent event) throws Exception {
    Client client = event.getClient();
    if (client == null) {
      throw new IllegalArgumentException("Event from uknown client " + event);
    }
    if (event instanceof ClientRequest && ((ClientRequest) event).isCommand()) {
      Command cmd = ((ClientRequest) event).getCommand();
      Object ret = cmd.execute(this, client);
      if (ret != null) {
        // synchronous command, send response
        client.sendMessage(ret);
      }
    } else {
      Scene scene = client.getScene();
      if (scene == null) {
        throw new UnsupportedOperationException("Client has no scene " + client);
      }
      if (event.sourceIs(client)) {
        event.setSource(client);
      } else {
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
    client.getScene().update();
  }

}
