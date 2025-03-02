package org.vrspace.server.core;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.dto.GroupMessage;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
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

  public void invite(UserGroup group, Long memberId, Client owner) {
    invite(group, getClient(memberId), owner);
  }

  /**
   * Invite a client to a group. For private groups, only owners can invite.
   * 
   * @param group
   * @param member
   */
  public void invite(UserGroup group, Client member, Client owner) {
    if (db.findGroupMember(group.getId(), member.getId()).isPresent()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already member of group " + group.getId());
    }
    if (group.isPrivate() && (owner == null || db.findOwnership(owner.getId(), group.getId()).isEmpty())) {
      throw new IllegalArgumentException("Only group owners can invite members");
    }
    GroupMember gm = new GroupMember(group, member).invite(owner.getId());
    db.save(gm);
    Client cachedClient = (Client) worldManager.get(member.getObjectId());
    if (cachedClient == null) {
      // TODO client is offline
      log.debug("Invite for offline client:" + member);
    } else {
      // online client, forward message
      // FIXME this serializes the message all over again for each recipient
      member.sendMessage(gm);
    }
  }

  /**
   * Accept invitation to a group, either public or private
   * 
   * @param group
   * @param member
   */
  public void accept(UserGroup group, Client member) {
    Optional<GroupMember> existingMember = db.findGroupMember(group.getId(), member.getId());
    if (existingMember.isEmpty() || existingMember.get().getPendingInvite() == null) {
      throw new IllegalArgumentException("Not invited client: " + member.getId());
    }
    GroupMember updatedMember = existingMember.get().accept();
    db.save(updatedMember);
  }

  /**
   * Ask to join a private group
   * 
   * @param group
   * @param member
   */
  public void ask(UserGroup group, Client member) {
    if (db.findGroupMember(group.getId(), member.getId()).isPresent()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already joining group " + group.getId());
    }
    GroupMember gm = new GroupMember(group, member).request();
    db.save(gm);
  }

  public void allow(UserGroup group, Long memberId, Client owner) {
    allow(group, owner, getClient(memberId));
  }

  /**
   * Allow a client who asked to join a private group
   * 
   * @param group
   * @param member
   */
  public void allow(UserGroup group, Client member, Client owner) {
    if (db.findOwnership(owner.getId(), group.getId()).isEmpty()) {
      throw new IllegalArgumentException("Only group owners can allow members");
    }
    Optional<GroupMember> invited = db.findGroupMember(group.getId(), member.getId());
    if (invited.isPresent()) {
      GroupMember gm = invited.get();
      if (gm.getPendingRequest() == null) {
        throw new IllegalArgumentException("No pending request for client: " + member.getId());
      }
      db.save(gm.allow(owner.getId()));
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
  public void leave(UserGroup group, Client member) {
    if (db.findOwnership(member.getId(), group.getId()).isPresent()) {
      throw new IllegalArgumentException("Group owners can not leave their groups");
    }
    this.removeMember(group, member);
  }

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
  public List<GroupMember> pendingInvitations(Client member) {
    return db.listPendingInvitations(member.getId());
  }

  private void addMember(UserGroup group, Client member) {
    GroupMember gm = new GroupMember(group, member);
    db.save(gm);
  }

  private void removeMember(UserGroup group, Client member) {
    db.findGroupMember(group.getId(), member.getId()).ifPresent(groupMember -> db.delete(groupMember));
  }

  public void addOwner(UserGroup group, Client owner) {
    Ownership ownership = new Ownership(owner, group);
    db.save(ownership);
  }

  public void removeOwner(UserGroup group, Client owner) {
    db.findOwnership(owner.getId(), group.getId()).ifPresent(ownership -> db.delete(ownership));
  }

  public void write(Client sender, UserGroup group, String text) {
    GroupMessage message = new GroupMessage(sender, group, text);
    if (db.findGroupMember(group.getId(), sender.getId()).isEmpty()) {
      throw new SecurityException("Only members can post to groups");
    }
    db.listGroupClients(group.getId()).forEach(client -> {
      // CHECKME: client.isActive() should to the trick
      // but we need a reference to live client instance to send the message
      Client cachedClient = (Client) worldManager.get(client.getObjectId());
      if (cachedClient == null) {
        // TODO client is offline
        log.debug("Message for offline client:" + client);
      } else {
        // online client, forward message
        // FIXME this serializes the message all over again for each recipient
        client.sendMessage(message);
      }
    });
  }

  public UserGroup getGroup(Client client, String name) {
    Optional<UserGroup> group = db.findGroup(client.getId(), name);
    if (group.isEmpty()) {
      throw new NotFoundException("Non-existing group: " + name + " clientId:" + client.getId());
    }
    return group.get();
  }

  public UserGroup getGroup(Client client, long groupId) {
    Optional<UserGroup> group = db.findGroup(client.getId(), groupId);
    if (group.isEmpty()) {
      throw new NotFoundException("Non-existing group: " + groupId + " clientId:" + client.getId());
    }
    return group.get();
  }

  public UserGroup getGroup(long groupId) {
    UserGroup group = db.get(UserGroup.class, groupId);
    if (group == null) {
      throw new NotFoundException("Non-existing group: " + groupId);
    }
    return group;
  }

  private Client getClient(long clientId) {
    Client client = db.getClient(clientId);
    if (client == null) {
      throw new NotFoundException("Non-existing client: " + clientId);
    }
    return client;
  }

}
