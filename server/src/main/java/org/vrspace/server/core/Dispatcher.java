package org.vrspace.server.core;

import java.io.IOException;
import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.Owned;
import org.vrspace.server.types.Private;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;

import lombok.extern.slf4j.Slf4j;

/**
 * Event dispatcher. Prior to dispatching an event, performs sanity and
 * ownership checks. Changes encapsulated in the event are then mapped to the
 * source object. All private fields are then filtered out, and remaining
 * changes are dispatched.
 * 
 * @see VREvent
 * @see Owned
 * @see Private
 * @author joe
 *
 */
@Slf4j
public class Dispatcher {
  private ObjectMapper objectMapper;

  public Dispatcher(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  // cache of all fields annotated with @Private
  private Map<Class<?>, Set<String>> privateFields = new ConcurrentHashMap<Class<?>, Set<String>>();
  // cache of all fields annotated with @Owned
  private Map<Class<?>, Set<String>> ownedFields = new ConcurrentHashMap<Class<?>, Set<String>>();

  protected void dispatch(VREvent event) throws JsonProcessingException, IOException {
    // sanity check
    if (event.getChanges().size() == 0) {
      throw new IllegalArgumentException("Event must contain changes");
    }
    if (event.getChanges().containsKey("id")) {
      throw new IllegalArgumentException("Object id cannot change");
    }
    if (event.getSource() == null) {
      throw new IllegalArgumentException("Source of event is null");
    }
    VRObject source = event.getSource();

    // ownership check
    if (!event.getClient().isOwner(source)) {
      if (source.getClass().isAnnotationPresent(Owned.class)) {
        throw new SecurityException("Cannot change owned object'");
      } else {
        declaredFields(source.getClass(), Owned.class, ownedFields).forEach(key -> {
          if (event.getChanges().containsKey(key)) {
            throw new SecurityException("Cannot change owned field '" + key + "'");
          }
        });
      }
    }

    String payload = event.getPayload();
    String changes = null;

    if (payload == null) {
      // internally generated event
      changes = objectMapper.writeValueAsString(event.getChanges());
      // generate payload here
      // otherwise every client has to serialize the message all over again
      event.setPayload(objectMapper.writeValueAsString(event));
    } else {
      // this came over client connection
      // something like
      // {"object":{"VRObject":1},"changes":{"field1":"value2","field2":5,...}}
      // so we speed it up a bit
      try {
        changes = payload.substring(payload.indexOf("{", payload.indexOf("}")), payload.length() - 1);
      } catch (Exception e) {
        throw new IllegalArgumentException("Invalid event payload: " + payload, e);
      }
      log.debug("Processing changes " + changes);
    }

    // merge changes
    ObjectReader reader = this.objectMapper.readerForUpdating(source);
    reader.readValue(changes);

    // remove all private changes before dispatching
    declaredFields(source.getClass(), Private.class, privateFields).forEach(event.getChanges()::remove);

    // and then notify listeners
    if (event.getChanges().size() > 0) {
      source.notifyListeners(event);
    }
  }

  // returns Set of annotated private fields on class
  private Set<String> declaredFields(Class<?> cls, Class<? extends Annotation> annotation,
      Map<Class<?>, Set<String>> fieldCache) {
    Set<String> ret = fieldCache.get(cls);
    if (ret == null) {
      ret = new LinkedHashSet<String>(1);
      if (cls.getSuperclass() != null) {
        ret = declaredFields(cls.getSuperclass(), annotation, fieldCache);
      }
      for (Field f : cls.getDeclaredFields()) {
        if (f.getAnnotation(annotation) != null) {
          ret.add(f.getName());
        }
      }
      fieldCache.put(cls, ret);
    }
    return ret;
  }

}
