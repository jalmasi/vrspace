package org.vrspace.server.dto;

import java.util.Optional;

import org.vrspace.server.core.GroupManager;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.UserGroup;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Command to manage groups: list/create/delete/show. To manage members:
 * join/ask/invite/accept/allow/leave/kick. Users can join/ask/accept/leave,
 * group owners can invite/allow/kick.
 * 
 * @author joe
 *
 */
@Data
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@JsonInclude(Include.NON_EMPTY)
@NoArgsConstructor
@AllArgsConstructor
public class Group implements Command {
  /** list/create/delete/show/join/ask/invite/accept/allow/leave/kick */
  private String action;
  /** used for create/delete commands */
  private String name;
  /** used for add/remove commands */
  private long clientId;

  public ClientResponse execute(WorldManager worldManager, Client client) throws Exception {
    GroupManager gm = worldManager.getGroupManager();
    VRObjectRepository db = worldManager.getDb();
    if ("list".equals(action)) {
      return new ClientResponse(db.listUserGroups(client.getId()));
    } else if ("create".equals(action)) {
      gm.createGroup(client, new UserGroup(name));
    } else if ("delete".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      gm.deleteGroup(client, group);
    } else if ("show".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      return new ClientResponse(db.listGroupClients(group.getId()));
    } else if ("join".equals(action)) {
      UserGroup group = getGroup(db, name);
      gm.join(group, client);
    } else if ("invite".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      Client member = getClient(db, clientId);
      gm.invite(group, member);
    } else if ("invite".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      gm.ask(group, client);
    } else if ("accept".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      gm.accept(group, client);
    } else if ("allow".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      Client newMember = getClient(db, clientId);
      gm.allow(group, newMember);
    } else if ("leave".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      gm.leave(group, client);
    } else if ("kick".equals(action)) {
      UserGroup group = getGroup(db, client.getId(), name);
      Optional<GroupMember> member = db.findGroupMember(group.getId(), clientId);
      if (member.isEmpty()) {
        throw new IllegalArgumentException("Group does not contain client: " + clientId);
      } else {
        gm.kick(group, member.get().getClient(), client);
      }
    } else {
      throw new UnsupportedOperationException("Invalid action:" + action);
    }
    return null;
  }

  private Client getClient(VRObjectRepository db, long clientId) {
    Client client = db.getClient(clientId);
    if (client == null) {
      throw new IllegalArgumentException("Non-existing client: " + clientId);
    }
    return client;
  }

  private UserGroup getGroup(VRObjectRepository db, String name) {
    Optional<UserGroup> group = db.findGroup(name);
    if (group.isEmpty()) {
      throw new IllegalArgumentException("Non-existing group: " + name);
    }
    return group.get();
  }

  private UserGroup getGroup(VRObjectRepository db, long clientId, String name) {
    Optional<UserGroup> group = db.findGroup(clientId, name);
    if (group.isEmpty()) {
      throw new IllegalArgumentException("Non-existing group: " + name);
    }
    return group.get();
  }
}
