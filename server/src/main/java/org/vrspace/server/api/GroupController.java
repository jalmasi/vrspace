package org.vrspace.server.api;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.GroupManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.GroupMessage;
import org.vrspace.server.obj.UserGroup;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

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
@Slf4j
public class GroupController extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/groups";

  @Autowired
  GroupManager groupManager;

  /**
   * List all user groups the user is member of.
   */
  @GetMapping
  public @ResponseBody List<UserGroup> listMyGroups(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Group list, user: " + client);
    return groupManager.listGroups(client);
  }

  /**
   * List all user groups the user owns.
   */
  @GetMapping("/owned")
  public @ResponseBody List<UserGroup> listOwnedGroups(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Group list, owner: " + client);
    return groupManager.listOwnedGroups(client);
  }

  /**
   * Create a group.
   * 
   * @param name      Group name
   * @param isPrivate Create a private group? Defaults to false.
   */
  @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public UserGroup create(String name, Optional<Boolean> isPublic, HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Group create, user: " + client + " group: " + name + " public: " + isPublic);
    return groupManager.createGroup(client, new UserGroup(name, isPublic.isPresent() && isPublic.get()));
  }

  /**
   * Update a group.
   * 
   * @param group updated group
   */
  @PutMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  public void update(@RequestBody UserGroup group, HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Group update, user: " + client + " group: " + group);
    groupManager.updateGroup(client, group);
  }

  /**
   * Delete a group. A group can only be deleted by the owner(s).
   */
  @DeleteMapping("/{groupId}")
  public void delete(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group delete, user: " + client + " group: " + group);
    groupManager.deleteGroup(client, group);
  }

  /**
   * Show all members of a group.
   */
  @GetMapping("/{groupId}/show")
  public List<Client> show(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group show, user: " + client + " group: " + group);
    return groupManager.show(group);
  }

  /**
   * Join a public group.
   */
  @PostMapping("/{groupId}/join")
  public void join(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(groupId);
    log.debug("Group join, user: " + client + " group: " + group);
    groupManager.join(group, client);
  }

  /**
   * Invite a user to a group. Only group owner(s) can invite users to private
   * groups. Invited users have to accept invitation.
   * 
   * @param groupId  Group to invite to
   * @param clientId Client to invite
   */
  @PostMapping("/{groupId}/invite")
  public void invite(@PathVariable long groupId, Long clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group invite, user: " + client + " group: " + group + " invited: " + clientId);
    groupManager.invite(group, clientId, client);
  }

  /**
   * Ask to join a private group. Group owner needs to allow new members to join.
   */
  @PostMapping("/{groupId}/ask")
  public void ask(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(groupId);
    log.debug("Group ask, user: " + client + " group: " + group);
    groupManager.ask(group, client);
  }

  /**
   * Accept invitation to a private group.
   */
  @PostMapping("/{groupId}/accept")
  public void accept(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group accept, user: " + client + " group: " + group);
    groupManager.accept(group, client);
  }

  /**
   * Allow a user (who asked) to join a private group. Only group owner(s) can do
   * that.
   * 
   * @param groupId  Group to join
   * @param clientId Client that asked to join
   */
  @PostMapping("/{groupId}/allow")
  public void allow(@PathVariable long groupId, long clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group allow, user: " + client + " group: " + group);
    groupManager.allow(group, clientId, client);
  }

  /**
   * Leave a group. Group owners can not leave. Also used to reject invitation to
   * join the group.
   */
  @PostMapping("/{groupId}/leave")
  public void leave(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group leave, user: " + client + " group: " + group);
    groupManager.leave(group, client);
  }

  /**
   * Kick a user from a group. Only group owner(s) can do that. Also used to
   * reject request to join.
   * 
   * @param groupId  Where to kick from
   * @param clientId Whom to kick
   */
  @PostMapping("/{groupId}/kick")
  public void kick(@PathVariable long groupId, long clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group kick, user: " + client + " group: " + group);
    groupManager.kick(group, clientId, client);
  }

  /**
   * Write something to a group.
   * 
   * @param groupId The group
   * @param text    The message
   */
  @PostMapping("/{groupId}/write")
  public void write(@PathVariable long groupId, @RequestBody String text, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    // FIXME sanitize text
    log.debug("Group write, user: " + client + " group: " + group + " text: " + text);
    groupManager.write(client, group, text);
  }

  /**
   * List pending requests to join the group. Only group owners can do that.
   * 
   * @param groupId
   */
  @GetMapping("/{groupId}/requests")
  public List<GroupMember> listRequests(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Group requests, user: " + client + " group: " + group);
    return groupManager.pendingRequests(group, client);
  }

  /**
   * List pending invitations to groups for the current user.
   * 
   * @param session
   */
  @GetMapping("/invitations")
  public List<GroupMember> listInvites(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Group invites, user: " + client);
    return groupManager.pendingInvitations(client);
  }

  @GetMapping("/unread")
  public List<UserGroup> listUnreadGroups(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Unread groups, user: " + client);
    return groupManager.unreadGroups(client);
  }

  @GetMapping("/{groupId}/unread")
  public List<GroupMessage> listUnreadMessages(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Unread messages, user: " + client + " group: " + group);
    return groupManager.unreadMessages(client, group);
  }

  @GetMapping("/{groupId}/owners")
  public List<Client> listOwners(@PathVariable long groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(client, groupId);
    log.debug("Unread messages, user: " + client + " group: " + group);
    return groupManager.listOwners(group);
  }

}
