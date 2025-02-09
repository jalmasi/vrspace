package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
  private VRObjectRepository db;
  @Autowired
  private GroupManager gm;

  @Test
  @Transactional
  public void testCreateDeleteListShow() {
    Client c1 = db.save(new Client());
    Client c2 = db.save(new Client());
    UserGroup group = gm.createGroup(c1, new UserGroup("test"));

    assertThrows(IllegalArgumentException.class, () -> gm.createGroup(c1, new UserGroup("test")));

    assertTrue(db.listGroupClients(group.getId()).contains(c1));
    assertTrue(db.listUserGroups(c1.getId()).contains(group));
    assertTrue(db.listOwnedGroups(c1.getId()).contains(group));
    assertTrue(db.findOwnership(c1.getId(), group.getId()).isPresent());

    assertThrows(SecurityException.class, () -> gm.deleteGroup(c2, group));
    gm.deleteGroup(c1, group);

    assertFalse(db.listGroupClients(group.getId()).contains(c1));
    assertFalse(db.listUserGroups(c1.getId()).contains(group));
    assertFalse(db.listOwnedGroups(c1.getId()).contains(group));
    assertFalse(db.findOwnership(c1.getId(), group.getId()).isPresent());
  }

  @Test
  @Transactional
  public void testPublicJoinLeave() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test"));
    assertThrows(IllegalArgumentException.class, () -> gm.leave(group, c1));

    Client c2 = db.save(new Client());
    gm.join(group, c2);

    assertTrue(db.listGroupClients(group.getId()).contains(c1));
    assertTrue(db.listGroupClients(group.getId()).contains(c2));

    assertThrows(IllegalArgumentException.class, () -> gm.kick(group, c2, c1));
    gm.leave(group, c2);

    assertTrue(db.listGroupClients(group.getId()).contains(c1));
    assertFalse(db.listGroupClients(group.getId()).contains(c2));

  }

  @Test
  @Transactional
  public void testPrivateJoinKick() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", true));

    Client c2 = db.save(new Client());

    assertThrows(IllegalArgumentException.class, () -> gm.join(group, c2));
    assertThrows(IllegalArgumentException.class, () -> gm.allow(group, c2, c1));

    gm.ask(group, c2);
    assertFalse(db.listGroupClients(group.getId()).contains(c2));
    assertEquals(1, db.listPendingRequests(group.getId()).size());

    assertThrows(IllegalArgumentException.class, () -> gm.ask(group, c2));
    assertThrows(IllegalArgumentException.class, () -> gm.allow(group, c2, c2));

    gm.allow(group, c2, c1);

    assertTrue(db.listGroupClients(group.getId()).contains(c2));
    assertEquals(0, db.listPendingRequests(group.getId()).size());

    assertThrows(SecurityException.class, () -> gm.kick(group, c2, c2));
    gm.kick(group, c2, c1);

    assertFalse(db.listGroupClients(group.getId()).contains(c2));
  }

  @Test
  @Transactional
  public void testPublicInvite() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test"));

    Client c2 = db.save(new Client());
    gm.invite(group, c2, null);

    assertTrue(db.listGroupClients(group.getId()).contains(c1));
    assertFalse(db.listGroupClients(group.getId()).contains(c2));

    assertNotNull(db.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertEquals(1, db.listPendingInvitations(c2.getId()).size());
    assertEquals(group, db.listPendingInvitations(c2.getId()).get(0).getGroup());

    gm.accept(group, c2);

    assertTrue(db.listGroupClients(group.getId()).contains(c2));
    assertNull(db.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertEquals(0, db.listPendingInvitations(c2.getId()).size());
  }

  @Test
  @Transactional
  public void testPrivateInvite() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", true));

    Client c2 = db.save(new Client());

    assertThrows(IllegalArgumentException.class, () -> gm.invite(group, c2, null));
    assertThrows(IllegalArgumentException.class, () -> gm.accept(group, c2));

    gm.invite(group, c2, c1);

    assertTrue(db.listGroupClients(group.getId()).contains(c1));
    assertFalse(db.listGroupClients(group.getId()).contains(c2));

    assertNotNull(db.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertEquals(1, db.listPendingInvitations(c2.getId()).size());
    assertEquals(group, db.listPendingInvitations(c2.getId()).get(0).getGroup());

    gm.accept(group, c2);

    assertNull(db.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertTrue(db.listGroupClients(group.getId()).contains(c2));
  }

}
