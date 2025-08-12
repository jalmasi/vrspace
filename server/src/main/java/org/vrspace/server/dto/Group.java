package org.vrspace.server.dto;

import org.vrspace.server.core.GroupManager;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
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
  /** list/create/delete/show/join/ask/invite/accept/allow/leave/kick/write */
  private String action;
  /** used for create/delete commands */
  private String name;
  /** used for add/remove/invite/kick commands */
  private String clientId;
  /** used for write action */
  private String text;

  public ClientResponse execute(WorldManager worldManager, Client client) throws Exception {
    GroupManager gm = GroupManager.getInstance();
    if ("list".equals(action)) {
      return new ClientResponse(gm.listGroups(client));
    } else if ("create".equals(action)) {
      gm.createGroup(client, new UserGroup(name));
    } else if ("delete".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.deleteGroup(client, group);
    } else if ("show".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      return new ClientResponse(gm.show(group));
    } else if ("join".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.join(group, client);
    } else if ("invite".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.invite(group, clientId, client);
    } else if ("ask".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.ask(group, client);
    } else if ("accept".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.accept(group, client);
    } else if ("allow".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.allow(group, clientId, client);
    } else if ("leave".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.leave(group, client);
    } else if ("kick".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.kick(group, clientId, client);
    } else if ("write".equals(action)) {
      UserGroup group = gm.getGroupByName(client, name);
      gm.write(client, group, text);
    } else {
      throw new UnsupportedOperationException("Invalid action:" + action);
    }
    return null;
  }

}
