package org.vrspace.server.core;

import java.util.Collections;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.neo4j.core.Neo4jTemplate;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;

import com.nimbusds.oauth2.sdk.util.StringUtils;

public class VRSpaceDBImpl implements VRSpaceDB {
  @Autowired
  Neo4jTemplate template;

  @Override
  public <T extends Entity> T get(Class<T> cls, Long id) {
    Optional<T> ret = findById(cls, id);
    if (ret.isPresent()) {
      return ret.get();
    }
    return null;
  }

  @Override
  public <T extends Entity> Optional<T> findById(Class<T> cls, Long id) {
    return template.findById(id, cls);
  }

  @Override
  public <T extends Client> T getClientByName(String name, Class<T> cls) {
    if (StringUtils.isBlank(name)) {
      throw new IllegalArgumentException("Empty client name: " + name);
    }
    Optional<Client> c = template.findOne("MATCH (o:" + cls.getSimpleName() + ") WHERE o.name = $name RETURN o",
        Collections.singletonMap("name", name), Client.class);
    if (c.isPresent()) {
      return get(cls, c.get().getId());
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  @Override
  public Client getClientByName(String name) {
    return getClientByName(name, Client.class);
  }

  @Override
  public <T extends Entity> void deleteById(Class<T> cls, Long id) {
    template.deleteById(id, cls);
  }

}
