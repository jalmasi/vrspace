package org.vrspace.server.api;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.GroupManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.UserGroup;

import jakarta.servlet.http.HttpSession;

/**
 * Manipulate user groups. All of these operations require a session with a
 * valid user currently logged in. So: login with either github, fb, google, and
 * enter a world before trying any of these.
 * 
 * @author joe
 *
 */
@RestController
@RequestMapping(GroupController.PATH)
public class GroupController extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/groups";

  @Autowired
  GroupManager groupManager;

  /**
   * List all user groups the user belongs to.
   */
  @GetMapping
  public List<UserGroup> list(HttpSession session) {
    Client client = getAuthorisedClient(session);
    return groupManager.listGroups(client);
  }

  /**
   * Create a group.
   * 
   * @param name      Group name
   * @param isPrivate Create a private group? Defaults to false.
   */
  @PostMapping
  public UserGroup create(String name, Optional<Boolean> isPrivate, HttpSession session) {
    Client client = getAuthorisedClient(session);
    return groupManager.createGroup(client, new UserGroup(name, isPrivate.isPresent() && isPrivate.get()));
  }

  /**
   * Delete a group. A group can only be deleted by the owner(s).
   */
  @DeleteMapping("/{groupId}")
  public void delete(long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.deleteGroup(client, group);
  }

  /**
   * Show all users belonging to a group
   */
  @GetMapping("/{groupId}/show")
  public List<Client> show(long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    return groupManager.show(group);
  }

  /**
   * Join a public group.
   */
  @PostMapping("/{groupId}/join")
  public void join(long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(groupId);
    groupManager.join(group, client);
  }

  /**
   * Invite a user a private group. Only group owner(s) can invite users.
   * 
   * @param groupId  Group to invite to
   * @param clientId Client to invite
   */
  @PostMapping("/{groupId}/invite")
  public void invite(long groupId, Long clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.invite(group, clientId, client);
  }

  /**
   * Ask to join a private group.
   */
  @PostMapping("/{groupId}/ask")
  public void ask(long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.ask(group, client);
  }

  /**
   * Accept invitation to a private group.
   */
  @PostMapping("/{groupId}/accept")
  public void accept(long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.accept(group, client);
  }

  /**
   * Allow user to join a private group. Only group owner(s) can do that.
   * 
   * @param groupId  Group to join
   * @param clientId Client that asked to join
   */
  @PostMapping("/{groupId}/allow")
  public void allow(long groupId, long clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.allow(group, clientId, client);
  }

  /**
   * Leave a group
   */
  @PostMapping("/{groupId}/leave")
  public void leave(long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.leave(group, client);
  }

  /**
   * Kick a user from a group. Only group owner(s) can do that.
   * 
   * @param groupId  Where to kick from
   * @param clientId Whom to kick
   */
  @PostMapping("/{groupId}/kick")
  public void kick(long groupId, long clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.kick(group, clientId, client);
  }

  /**
   * Write something to a group.
   * 
   * @param groupId The group
   * @param text    The message
   */
  @PostMapping("/{groupId}/write")
  public void write(long groupId, @RequestBody String text, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    groupManager.write(client, group, text);
  }

  protected Client getAuthorisedClient(HttpSession session) {
    if (!isAuthenticated(session)) {
      throw new SecurityException("Anonymous user");
    }
    Client client = findClient(session);
    if (client.isTemporary()) {
      throw new SecurityException("Temporary user");
    }
    return client;
  }
}
