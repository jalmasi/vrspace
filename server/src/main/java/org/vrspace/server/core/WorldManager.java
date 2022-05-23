package org.vrspace.server.core;

import java.lang.reflect.Modifier;
import java.security.Principal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.neo4j.core.mapping.Neo4jMappingContext;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
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
import com.nimbusds.oauth2.sdk.util.StringUtils;

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
  private StreamManager streamManager;

  @Autowired
  protected ClientFactory clientFactory; // used in tests

  @Autowired
  private Neo4jMappingContext mappingContext;

  private Dispatcher dispatcher;

  protected SessionTracker sessionTracker;

  // used in tests
  protected ConcurrentHashMap<ID, VRObject> cache = new ConcurrentHashMap<ID, VRObject>();

  protected VRObject get(ID id) {
    return cache.get(id);
  }

  private World defaultWorld;

  @PostConstruct
  public void init() {
    this.dispatcher = new Dispatcher(jackson);
    this.sessionTracker = new SessionTracker(config);
  }

  // CHECKME: should this be here?
  public List<Class<?>> listClasses() {
    // gotta love oneliners :)
    return mappingContext.getManagedTypes().stream().filter(
        info -> !Modifier.isAbstract(info.getType().getModifiers()) && Entity.class.isAssignableFrom(info.getType()))
        .map(i -> i.getType()).collect(Collectors.toList());
  }

  public Set<VRObject> getPermanents(Client client) {
    return db.getPermanents(client.getWorld().getId());
  }

  public World getWorld(String name) {
    return db.getWorldByName(name);
  }

  public World getOrCreateWorld(String name) {
    World world = getWorld(name);
    if (world == null) {
      if (config.isCreateWorlds()) {
        world = db.save(new World(name));
      } else {
        throw new IllegalArgumentException("Unknown world: " + name);
      }
    }
    return world;
  }

  public Client getClientByName(String name) {
    Client ret = db.getClientByName(name);
    return (Client) updateCache(ret);
  }

  public <T extends Client> T getClientByName(String name, Class<T> cls) {
    T ret = db.getClientByName(name, cls);
    return (T) updateCache(ret);
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
        o = db.get(o.getClass(), o.getId());
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
      if (o.getTemporary() == null && client.isGuest()) {
        o.setTemporary(true);
      }
      o = db.save(o);
      client.addOwned(o);
      cache.put(o.getObjectId(), o);
      return o;
    }).collect(Collectors.toList());
    db.save(client);
    return ret;
  }

  public void remove(Client client, VRObject obj) {
    // CHECKME: remove invisible objects?
    if (!client.isOwner(obj)) {
      throw new SecurityException("Not yours to remove: " + obj.getClass().getSimpleName() + " " + obj.getId());
    }
    client.removeOwned(obj);
    db.save(client);
    delete(client, obj);
  }

  private void delete(Client client, VRObject obj) {
    cache.remove(obj.getObjectId());
    client.getWriteBack().delete(obj);
  }

  /**
   * Remote user login over websocket. Called SessionManager, after websocket
   * session has been established. Uses session security context (principal) to
   * identify user and fetch/create the appropriate Client object from the
   * ClientFactory. May create a new guest client, if guest (anonymous)
   * connections are allowed.
   * 
   * @param session websocket session
   * @return Welcome message
   */
  @Transactional
  public Welcome login(ConcurrentWebSocketSessionDecorator session) {
    Principal principal = session.getPrincipal();
    HttpHeaders headers = session.getHandshakeHeaders();
    Map<String, Object> attributes = session.getAttributes();
    log.debug("Login principal: " + principal + " headers: " + headers + " attributes: " + attributes);
    // principal may be OAuth2AuthenticationToken, in that case getName() returns
    // token value, getAuthorizedClientRegistrationId() return the authority
    // (github, facebook...)
    Client client = null;
    if (session.getPrincipal() != null) {
      client = clientFactory.findClient(principal, db, headers, attributes);
      if (client == null) {
        throw new SecurityException("Unauthorized client " + session.getPrincipal().getName());
      }
    } else if (config.isGuestAllowed()) {
      client = clientFactory.createGuestClient(headers, attributes);
      if (client == null) {
        throw new SecurityException("Guest disallowed");
      }
      client.setPosition(new Point());
      client.setGuest(true);
      client = db.save(client);
    } else {
      client = clientFactory.handleUnknownClient(headers, attributes);
      if (client == null) {
        throw new SecurityException("Unauthorized");
      }
    }
    client.setSession(session);
    login(client);
    return enter(client, defaultWorld());
  }

  /**
   * Stage 2 of login, executed once client has been identified. Does not depend
   * on websocket session, can be used for internal login, e.g. bots.
   * 
   * @param client
   */
  public void login(Client client) {
    client.setMapper(jackson);
    client.setSceneProperties(sceneProperties.newInstance());
    WriteBack writeBack = new WriteBack(db);
    writeBack.setActive(config.isWriteBackActive());
    writeBack.setDelay(config.getWriteBackDelay());
    client.setWriteBack(writeBack);
    cache.put(new ID(client), client);
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
    World world = getOrCreateWorld(worldName);
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

  public void startSession(Client client) throws SessionException {
    if (StringUtils.isNotBlank(client.getName())) {
      // new client can't have the same name as existing one
      Client existing = getClientByName(client.getName());
      if (existing != null && existing.getName() != null && client.getName().equals(existing.getName())
          && !existing.getId().equals(client.getId())) {
        throw new SessionException("Client named '" + client.getName() + "' already exists");
      }
    }
    sessionTracker.addSession(client);

    // client must have position to have scene
    // depending on how we create client that may not be the case
    if (client.getPosition() == null) {
      client.setPosition(new Point());
    }
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
            delete(client, owned);
            log.debug("Deleted owned temporary " + owned.getObjectId());
          }
        }
      }
      delete(client, client);
      log.debug("Deleted guest client " + client.getId());
    }
    client.getWriteBack().flush();
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
      client.getWriteBack().write(event.getSource());
    }
    if (scene != null) {
      scene.update();
    }
  }

}
