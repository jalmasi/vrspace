package org.vrspace.server.core;

import java.util.Optional;

import org.springframework.stereotype.Component;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;

@Component
public interface VRSpaceDB {
  <T extends Entity> T get(Class<T> cls, Long id);

  <T extends Client> T getClientByName(String name);

  <T extends Client> T getClientByName(String name, Class<T> cls);

  <T extends Entity> Optional<T> findById(Class<T> cls, Long id);

  <T extends Entity> void deleteById(Class<T> cls, Long id);
}
