package org.vrspace.server.core;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.neo4j.core.Neo4jClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.dto.GroupEvent;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.GroupMessage;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.UserGroup;

import lombok.extern.slf4j.Slf4j;

/**
 * Manages client group membership and ownership. General workflow when joining
 * private groups: ask to join, owner allows. OR, invite a member, member
 * accepts. For public groups, member just joins, though invite/accept should
 * work. User can leave the group, or get kicked by the owner.
 * 
 * @author joe
 *
 */
@Slf4j
@Component
@Lazy
public class GroupManager {
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private WorldManager worldManager;
  @Autowired
  private Neo4jClient neo4jClient;

  @Transactional
  public List<UserGroup> listGroups(Client client) {
    return db.listUserGroups(client.getId());
  }

  @Transactional
  public List<UserGroup> listOwnedGroups(Client client) {
    return db.listOwnedGroups(client.getId());
  }

  @Transactional
  public UserGroup createGroup(Client client, UserGroup group) {
    if (db.findGroup(client.getId(), group.getName()).isPresent()) {
      throw new IllegalArgumentException("Client already belongs to group " + group.getName());
    }
    group = db.save(group);
    addOwner(group, client);
    addMember(group, client);
    return group;
  }

  @Transactional
  public UserGroup updateGroup(Client client, UserGroup group) {
    if (db.getOwnership(client.getId(), group.getId()) == null) {
      throw new SecurityException("Not an owner");
    }
    group = db.save(group);
    return group;
  }

  @Transactional
  public void deleteGroup(Client client, UserGroup group) {
    if (db.getOwnership(client.getId(), group.getId()) == null) {
      throw new SecurityException("Not an owner");
    }
    // delete memberships
    db.listGroupMembers(group.getId()).forEach(groupMember -> db.delete(groupMember));
    // delete ownership(s)
    db.getOwnersOf(group.getId()).forEach(ownership -> db.delete(ownership));
  }

  @Transactional
  public List<Client> show(UserGroup group) {
    return db.listGroupClients(group.getId());
  }

  @Transactional
  public void invite(UserGroup group, Long memberId, Client owner) {
    invite(group, getClient(memberId), owner);
  }

  /**
   * Invite a client to a group. For private groups, only owners can invite.
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void invite(UserGroup group, Client member, Client owner) {
    if (db.findGroupMember(group.getId(), member.getId()).isPresent()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already member of group " + group.getId());
    }
    if (group.isPrivate() && (owner == null || db.findOwnership(owner.getId(), group.getId()).isEmpty())) {
      throw new IllegalArgumentException("Only group owners can invite members");
    }
    GroupMember gm = new GroupMember(group, member).invite(owner);
    save(gm);
    Client cachedClient = getCachedClient(member);
    if (cachedClient == null) {
      // TODO client is offline
      log.debug("Invite for offline client:" + member);
    } else {
      // online client, forward message
      // FIXME this serializes the message all over again for each recipient
      cachedClient.sendMessage(GroupEvent.invite(gm));
    }
  }

  /**
   * Accept invitation to a group, either public or private
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void accept(UserGroup group, Client member) {
    // shallow copy:
    Optional<GroupMember> existingMember = db.findGroupMember(group.getId(), member.getId());
    if (existingMember.isEmpty() || existingMember.get().getPendingInvite() == null) {
      throw new IllegalArgumentException("Not invited client: " + member.getId());
    }
    // so fetch deep copy first:
    GroupMember updatedMember = db.get(existingMember).accept();
    save(updatedMember);
  }

  /**
   * Ask to join a private group
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void ask(UserGroup group, Client member) {
    if (db.findGroupMember(group.getId(), member.getId()).isPresent()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already joining group " + group.getId());
    }
    GroupMember gm = new GroupMember(group, member).request();
    save(gm);
  }

  @Transactional
  public void allow(UserGroup group, Long memberId, Client owner) {
    allow(group, owner, getClient(memberId));
  }

  /**
   * Allow a client who asked to join a private group
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void allow(UserGroup group, Client member, Client owner) {
    if (db.findOwnership(owner.getId(), group.getId()).isEmpty()) {
      throw new IllegalArgumentException("Only group owners can allow members");
    }
    Optional<GroupMember> invited = db.findGroupMember(group.getId(), member.getId());
    if (invited.isPresent()) {
      GroupMember gm = db.get(invited);
      if (gm.getPendingRequest() == null) {
        throw new IllegalArgumentException("No pending request for client: " + member.getId());
      }
      save(gm.allow(owner));
    } else {
      throw new IllegalArgumentException("Not invited client: " + member.getId());
    }
  }

  /**
   * Join a public group
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void join(UserGroup group, Client member) {
    if (group.isPrivate()) {
      throw new IllegalArgumentException("Ask to join a private group");
    } else {
      // join public group
      addMember(group, member);
    }
  }

  /**
   * Leave a group
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void leave(UserGroup group, Client member) {
    if (db.findOwnership(member.getId(), group.getId()).isPresent()) {
      throw new IllegalArgumentException("Group owners can not leave their groups");
    }
    this.removeMember(group, member);
  }

  @Transactional
  public void kick(UserGroup group, long memberId, Client owner) {
    Optional<GroupMember> member = db.findGroupMember(group.getId(), memberId);
    if (member.isEmpty()) {
      throw new IllegalArgumentException("Group does not contain client: " + memberId);
    } else {
      kick(group, member.get().getClient(), owner);
    }
  }

  /**
   * Group owner can kick another user from the group
   * 
   * @param group
   * @param member
   */
  @Transactional
  public void kick(UserGroup group, Client member, Client owner) {
    if (!group.isPrivate()) {
      throw new IllegalArgumentException("Can't kick members from public groups");
    }
    if (db.findOwnership(owner.getId(), group.getId()).isEmpty()) {
      throw new SecurityException("Only group owners can kick members");
    }
    removeMember(group, member);
  }

  /**
   * Group owner can list all pending join requests
   * 
   * @param group
   * @param member
   * @return
   */
  @Transactional
  public List<GroupMember> pendingRequests(UserGroup group, Client member) {
    if (db.findOwnership(member.getId(), group.getId()).isEmpty()) {
      throw new SecurityException("Only group owners can list pending requets");
    }
    return db.listPendingRequests(group.getId());
  }

  /**
   * Any user can list their own pending invitations
   * 
   * @param member
   * @return
   */
  @Transactional
  public List<GroupMember> pendingInvitations(Client member) {
    return db.listPendingInvitations(member.getId());
  }

  private void addMember(UserGroup group, Client member) {
    GroupMember gm = new GroupMember(group, member);
    save(gm);
  }

  private void removeMember(UserGroup group, Client member) {
    db.findGroupMember(group.getId(), member.getId()).ifPresent(groupMember -> db.delete(groupMember));
  }

  @Transactional
  public void addOwner(UserGroup group, Client owner) {
    Ownership ownership = new Ownership(owner, group);
    db.save(ownership);
  }

  @Transactional
  public void removeOwner(UserGroup group, Client owner) {
    db.findOwnership(owner.getId(), group.getId()).ifPresent(ownership -> db.delete(ownership));
  }

  @Transactional
  public void write(Client sender, UserGroup group, String text) {
    if (db.findGroupMember(group.getId(), sender.getId()).isEmpty()) {
      throw new SecurityException("Only members can post to groups");
    }
    GroupMessage message = db.save(new GroupMessage(sender, group, text, Instant.now()));
    db.listGroupClients(group.getId()).forEach(client -> {
      // CHECKME: client.isActive() should to the trick
      // but we need a reference to live client instance to send the message
      Client cachedClient = getCachedClient(client);
      if (cachedClient == null) {
        // TODO client is offline
        log.debug("Message for offline client:" + client);
      } else {
        // online client, forward message
        // FIXME this serializes the message all over again for each recipient
        cachedClient.sendMessage(GroupEvent.message(message));
      }
    });
  }

  @Transactional
  public UserGroup getGroup(Client client, String name) {
    Optional<UserGroup> group = db.findGroup(client.getId(), name);
    if (group.isEmpty()) {
      throw new NotFoundException("Non-existing group: " + name + " clientId:" + client.getId());
    }
    return group.get();
  }

  @Transactional
  public UserGroup getGroup(Client client, long groupId) {
    Optional<UserGroup> group = db.findGroup(client.getId(), groupId);
    if (group.isEmpty()) {
      throw new NotFoundException("Non-existing group: " + groupId + " clientId:" + client.getId());
    }
    return group.get();
  }

  @Transactional
  public UserGroup getGroup(long groupId) {
    UserGroup group = db.get(UserGroup.class, groupId);
    if (group == null) {
      throw new NotFoundException("Non-existing group: " + groupId);
    }
    return group;
  }

  @Transactional
  public List<UserGroup> unreadGroups(Client client) {
    List<GroupMember> groups = db.listGroupMemberships(client.getId());
    groups.forEach((gm) -> {
      UserGroup group = gm.getGroup();
      int unread = db.unreadMessageCount(group.getId(), gm.getLastRead());
      group.setUnread(unread);
    });
    return groups.stream().map(gm -> gm.getGroup()).filter(g -> g.getUnread() > 0).collect(Collectors.toList());
  }

  @Transactional
  public List<GroupMessage> unreadMessages(Client client, UserGroup group) {
    Instant now = Instant.now();
    Optional<GroupMember> gm = db.findGroupMember(group.getId(), client.getId());
    if (gm.isEmpty()) {
      throw new NotFoundException("Not a member group: " + group.getId() + " clientId:" + client.getId());
    }
    GroupMember member = gm.get();
    Instant lastRead = member.getLastRead();
    member.setLastRead(now);
    save(member);
    return db.messagesSince(group.getId(), lastRead);
  }

  @Transactional
  public List<Client> listOwners(UserGroup group) {
    return db.getOwners(group.getId()).stream().map(ownership -> ownership.getOwner()).toList();
  }

  private Client getClient(long clientId) {
    Client client = db.getClient(clientId);
    if (client == null) {
      throw new NotFoundException("Non-existing client: " + clientId);
    }
    // log.debug(client.getId() + " " + client.getPosition());
    return client;
  }

  private Client getCachedClient(Client c) {
    Client cachedClient = (Client) worldManager.get(c.getObjectId());
    if (cachedClient != null && !cachedClient.isActive()) {
      log.error("Client is not active " + c);
    }
    return cachedClient;
  }

  private void save(GroupMember gm) {
    db.save(gm);
    // log.debug(gm.getClient().getId() + " " + gm.getClient().getPosition());
  }
}
