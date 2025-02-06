package org.vrspace.server.core;

import java.util.Optional;
import java.util.UUID;

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
public class GroupManager {
  private VRObjectRepository db;
  private WorldManager worldManager;

  public GroupManager(WorldManager worldManager, VRObjectRepository db) {
    this.worldManager = worldManager;
    this.db = db;
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
  public void deleteGroup(Client client, UserGroup group) {
    group = db.get(UserGroup.class, group.getId());
    if (group != null) {
      // delete memberships
      db.listGroupMembers(group.getId()).forEach(groupMember -> db.delete(groupMember));
      // delete ownership(s)
      db.getOwnersOf(group.getId()).forEach(ownership -> db.delete(ownership));
    }
  }

  /**
   * Invite a client to a group. For private groups, only owners can invite.
   * 
   * @param group
   * @param member
   */
  public void invite(UserGroup group, Client member) {
    if (db.findGroupMember(group.getId(), member.getId()).isPresent()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already member of group " + group.getId());
    }
    if (group.isPrivate() && db.findOwnership(member.getId(), group.getId()).isEmpty()) {
      throw new IllegalArgumentException("Only group owners can invite members");
    }
    GroupMember gm = new GroupMember(group, member, UUID.randomUUID().toString(), null);
    db.save(gm);
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
    GroupMember updatedMember = existingMember.get();
    updatedMember.setPendingInvite(null);
    db.save(updatedMember);
  }

  /**
   * Ask to join a private group
   * 
   * @param group
   * @param member
   */
  public void ask(UserGroup group, Client member) {
    if (db.findGroupMember(group.getId(), member.getId()).isEmpty()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already joining group " + group.getId());
    }
    GroupMember gm = new GroupMember(group, member, null, UUID.randomUUID().toString());
    db.save(gm);
  }

  /**
   * Allow a client who asked to join a private group
   * 
   * @param group
   * @param member
   */
  public void allow(UserGroup group, Client member) {
    db.findGroupMember(group.getId(), member.getId()).ifPresent(invited -> {
      if (invited.getPendingRequest() == null) {
        throw new IllegalArgumentException("Not invited client: " + member.getId());
      }
      invited.setPendingRequest(null);
      db.save(invited);
    });

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
    this.removeMember(group, member);
  }

  /**
   * Group owner can kick another user from the group
   * 
   * @param group
   * @param member
   */
  public void kick(UserGroup group, Client member, Client owner) {
    if (!group.isPrivate()) {
      throw new IllegalArgumentException("Can't kick members fro public groups");
    }
    if (db.findOwnership(owner.getId(), group.getId()).isEmpty()) {
      throw new IllegalArgumentException("Only group owners can kick members");
    }
    removeMember(group, member);
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
    db.listGroupMembers(group.getId()).stream().filter(member -> member.joined()).map(member -> member.getClient())
        .forEach(client -> {
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
}
