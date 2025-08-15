package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Content;
import org.vrspace.server.obj.GroupMessage;
import org.vrspace.server.obj.UserGroup;

@SpringBootTest
@ExtendWith(MockitoExtension.class)
public class GroupManagerIT {

  @Autowired
  private VRObjectRepository db;
  @Autowired
  private GroupRepository groupRepo;
  @Autowired
  private GroupManager gm;

  @Test
  @Transactional
  public void testCreateDeleteListShow() {
    Client c1 = db.save(new Client());
    Client c2 = db.save(new Client());
    UserGroup group = gm.createGroup(c1, new UserGroup("test"));

    assertThrows(IllegalArgumentException.class, () -> gm.createGroup(c1, new UserGroup("test")));

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c1));
    assertTrue(groupRepo.listUserGroups(c1.getId()).contains(group));
    assertTrue(groupRepo.listOwnedGroups(c1.getId()).contains(group));
    assertTrue(db.findOwnership(c1.getId(), group.getId()).isPresent());

    assertThrows(SecurityException.class, () -> gm.deleteGroup(c2, group));
    gm.deleteGroup(c1, group);

    assertFalse(groupRepo.listGroupClients(group.getId()).contains(c1));
    assertFalse(groupRepo.listUserGroups(c1.getId()).contains(group));
    assertFalse(groupRepo.listOwnedGroups(c1.getId()).contains(group));
    assertFalse(db.findOwnership(c1.getId(), group.getId()).isPresent());
    assertFalse(groupRepo.findById(UserGroup.class, group.getId()).isPresent());
  }

  @Test
  @Transactional
  public void testPublicJoinLeave() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", true, false));
    assertThrows(IllegalArgumentException.class, () -> gm.leave(group, c1));

    Client c2 = db.save(new Client());
    gm.join(group, c2);

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c1));
    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c2));

    assertThrows(IllegalArgumentException.class, () -> gm.kick(group, c2, c1));
    gm.leave(group, c2);

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c1));
    assertFalse(groupRepo.listGroupClients(group.getId()).contains(c2));

  }

  @Test
  @Transactional
  public void testPrivateJoinKick() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", false, false));

    Client c2 = db.save(new Client());

    assertThrows(IllegalArgumentException.class, () -> gm.join(group, c2));
    assertThrows(IllegalArgumentException.class, () -> gm.allow(group, c2, c1));

    gm.ask(group, c2);
    assertFalse(groupRepo.listGroupClients(group.getId()).contains(c2));
    assertEquals(1, groupRepo.listPendingRequests(group.getId()).size());

    assertThrows(IllegalArgumentException.class, () -> gm.ask(group, c2));
    assertThrows(IllegalArgumentException.class, () -> gm.allow(group, c2, c2));

    gm.allow(group, c2, c1);

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c2));
    assertEquals(0, groupRepo.listPendingRequests(group.getId()).size());

    assertThrows(SecurityException.class, () -> gm.kick(group, c2, c2));
    gm.kick(group, c2, c1);

    assertFalse(groupRepo.listGroupClients(group.getId()).contains(c2));
  }

  @Test
  @Transactional
  public void testPublicInvite() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", true, false));

    Client c2 = db.save(new Client());
    gm.invite(group, c2, c1);

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c1));
    assertFalse(groupRepo.listGroupClients(group.getId()).contains(c2));

    assertNotNull(groupRepo.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertEquals(1, groupRepo.listPendingInvitations(c2.getId()).size());
    assertEquals(group, groupRepo.listPendingInvitations(c2.getId()).get(0).getGroup());

    gm.accept(group, c2);

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c2));
    assertNull(groupRepo.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertEquals(0, groupRepo.listPendingInvitations(c2.getId()).size());
  }

  @Test
  @Transactional
  public void testPrivateInvite() {
    Client c1 = db.save(new Client());

    UserGroup group = gm.createGroup(c1, new UserGroup("test", false, false));

    Client c2 = db.save(new Client());

    assertThrows(IllegalArgumentException.class, () -> gm.invite(group, c2, null));
    assertThrows(IllegalArgumentException.class, () -> gm.accept(group, c2));

    gm.invite(group, c2, c1);

    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c1));
    assertFalse(groupRepo.listGroupClients(group.getId()).contains(c2));

    assertNotNull(groupRepo.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertEquals(1, groupRepo.listPendingInvitations(c2.getId()).size());
    assertEquals(group, groupRepo.listPendingInvitations(c2.getId()).get(0).getGroup());

    gm.accept(group, c2);

    assertNull(groupRepo.findGroupMember(group.getId(), c2.getId()).get().getPendingInvite());
    assertTrue(groupRepo.listGroupClients(group.getId()).contains(c2));
  }

  @Test
  @Transactional
  public void testUnread() {
    Client c1 = db.save(new Client());

    UserGroup group1 = gm.createGroup(c1, new UserGroup("group1", true, false));
    UserGroup group2 = gm.createGroup(c1, new UserGroup("group2", true, false));
    UserGroup group3 = gm.createGroup(c1, new UserGroup("group3", true, false));
    gm.write(c1, group1, "msg1");

    Client c2 = db.save(new Client());
    gm.join(group1, c2);
    gm.join(group2, c2);

    List<UserGroup> unreadGroups = gm.unreadGroups(c2);

    assertEquals(1, unreadGroups.size());
    assertEquals(1, unreadGroups.iterator().next().getUnread());

    List<GroupMessage> unreadMessages = gm.unreadMessages(c2, group1);

    assertEquals(1, unreadMessages.size());

    unreadMessages = gm.unreadMessages(c2, group1);

    assertEquals(0, unreadMessages.size());

    assertThrows(NotFoundException.class, () -> gm.unreadMessages(c2, group3));
  }

  @Test
  @Transactional
  public void testAttachments() {
    Client client = db.save(new Client());
    UserGroup group1 = gm.createGroup(client, new UserGroup("group1", true, false));
    String id = gm.write(client, group1, "this message is to contain attachments");

    Content file1 = new Content();
    file1.setFileName("file1");
    Content file2 = new Content();
    file2.setFileName("file2");

    // create attachments
    gm.attach(client, group1, id, file1);
    gm.attach(client, group1, id, file2);

    GroupMessage msg = db.get(GroupMessage.class, id);

    assertEquals(2, msg.getAttachments().size());
    assertEquals("file1", msg.getAttachments().get(0).getFileName());
    assertEquals("file2", msg.getAttachments().get(1).getFileName());

    Content c1 = gm.getAttachment(client, group1, id, file1.getFileName());
    Content c2 = gm.getAttachment(client, group1, id, file2.getFileName());

    assertEquals(file1, c1);
    assertEquals(file2, c2);

    // delete attachment(s)
    gm.detach(client, group1, id, file1.getFileName());

    msg = db.get(GroupMessage.class, id);

    assertEquals(1, msg.getAttachments().size());
    assertEquals("file2", msg.getAttachments().get(0).getFileName());
  }
}
