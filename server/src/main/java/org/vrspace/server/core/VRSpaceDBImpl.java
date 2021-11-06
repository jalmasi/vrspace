package org.vrspace.server.core;

import java.util.Collections;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.neo4j.core.Neo4jTemplate;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;

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
  public Client getClientByName(String name) {
    Optional<Client> c = template.findOne("MATCH (o:Client) WHERE o.name = $name RETURN o",
        Collections.singletonMap("name", name), Client.class);
    if (c.isPresent()) {
      return get(Client.class, c.get().getId());
    }
    return null;
  }

  @Override
  public <T extends Entity> void deleteById(Class<T> cls, Long id) {
    template.deleteById(id, cls);
  }

}
