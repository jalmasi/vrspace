package org.vrspace.server.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.dto.GroupMessage;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.UserGroup;

import lombok.extern.slf4j.Slf4j;

/**
 * Component that manages client group membership and ownership.
 * 
 * @author joe
 *
 */
@Component
@DependsOn({ "database" })
@Slf4j
public class GroupManager {
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private WorldManager worldManager;

  @Transactional
  public UserGroup createGroup(Client client, UserGroup group) {
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

  public void addMember(UserGroup group, Client member) {
    GroupMember gm = new GroupMember(group, member);
    db.save(gm);
  }

  public void addOwner(UserGroup group, Client owner) {
    Ownership ownership = new Ownership(owner, group);
    db.save(ownership);
  }

  public void removeMember(UserGroup group, Client member) {
    db.findGroupMember(group.getId(), member.getId()).ifPresent(groupMember -> db.delete(groupMember));
  }

  public void removeOwner(UserGroup group, Client owner) {
    db.findOwnership(owner.getId(), group.getId()).ifPresent(ownership -> db.delete(ownership));
  }

  public void write(Client sender, UserGroup group, String text) {
    GroupMessage message = new GroupMessage(sender, group, text);
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
}
