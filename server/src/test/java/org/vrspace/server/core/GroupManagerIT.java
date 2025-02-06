package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.UserGroup;

@SpringBootTest
@ExtendWith(MockitoExtension.class)
public class GroupManagerIT {

  @Autowired
  private WorldManager worldManager;
  private VRObjectRepository db;
  private GroupManager gm;

  @BeforeEach
  public void setup() {
    db = worldManager.getDb();
    gm = worldManager.getGroupManager();
  }

  @Test
  @Transactional
  public void testPublicJoin() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test"));

    Client c2 = db.save(new Client());
    gm.join(group, c2);

    assertTrue(db.listGroupClients(group.getId()).contains(c1));
    assertTrue(db.listGroupClients(group.getId()).contains(c2));
  }

  @Test
  @Transactional
  public void testPrivateJoin() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", true));

    Client c2 = db.save(new Client());

    assertThrows(IllegalArgumentException.class, () -> gm.join(group, c2));
    assertThrows(IllegalArgumentException.class, () -> gm.allow(group, c2));

    gm.ask(group, c2);
    assertTrue(db.listGroupClients(group.getId()).contains(c2));

    assertThrows(IllegalArgumentException.class, () -> gm.ask(group, c2));

    gm.allow(group, c2);

    assertTrue(db.listGroupClients(group.getId()).contains(c2));
  }
}
