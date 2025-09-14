package org.vrspace.server.api;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.vrspace.server.core.FileUtil;
import org.vrspace.server.core.GroupManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Content;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.GroupMessage;
import org.vrspace.server.obj.UserGroup;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Manipulate user groups. All of these operations require a session with a
 * valid user currently logged in. So: login with either github, fb, google, and
 * enter a world before trying any of these. Only group members can read and
 * write group messages. Groups can public or private: everybody can join public
 * groups, and private groups require invitation by group owner(s). Temporary
 * groups are deleted after owner disconnects.
 * 
 * @author joe
 *
 */
@RestController
@RequestMapping(Groups.PATH)
@Slf4j
public class Groups extends ClientControllerBase {
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
   * @param name        Group name
   * @param isPublic    Create a public group? Defaults to false.
   * @param isTemporary Create a temporary group? Defaults to false.
   */
  @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public UserGroup create(String name, Optional<Boolean> isPublic, Optional<Boolean> isTemporary, HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug(
        "Group create, user: " + client + " group: " + name + " public: " + isPublic + " temporary: " + isTemporary);
    return groupManager.createGroup(client,
        new UserGroup(name, isPublic.isPresent() && isPublic.get(), isTemporary.isPresent() && isTemporary.get()));
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
  public void deleteGroup(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Group delete, user: " + client + " group: " + group);
    groupManager.deleteGroup(client, group);
  }

  /**
   * Get a group.
   */
  @GetMapping("/{groupId}")
  public UserGroup getGroup(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(groupId);
    log.debug("Group get, user: " + client + " group: " + group);
    return group;
  }

  /**
   * Show all members of a group.
   */
  @GetMapping("/{groupId}/show")
  public List<Client> show(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Group show, user: " + client + " group: " + group);
    return groupManager.show(group);
  }

  /**
   * Join a public group.
   */
  @PostMapping("/{groupId}/join")
  public void join(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(groupId);
    log.debug("Group join, user: " + client + " group: " + group);
    groupManager.join(group, client);
  }

  /**
   * Invite a user to a group. Only group owner(s) can invite users to private
   * groups. Invited users have to accept invitation. Offline users may get web
   * push notification, if these are configured.
   * 
   * @param groupId  Group to invite to
   * @param clientId Client to invite
   */
  @PostMapping("/{groupId}/invite")
  public void invite(@PathVariable String groupId, String clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Group invite, user: " + client + " group: " + group + " invited: " + clientId);
    groupManager.invite(group, clientId, client);
  }

  /**
   * Ask to join a private group. Group owner needs to allow new members to join.
   */
  @PostMapping("/{groupId}/ask")
  public void ask(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroup(groupId);
    log.debug("Group ask, user: " + client + " group: " + group);
    groupManager.ask(group, client);
  }

  /**
   * Accept invitation to a private group.
   */
  @PostMapping("/{groupId}/accept")
  public void accept(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
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
  public void allow(@PathVariable String groupId, String clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Group allow, user: " + client + " group: " + group);
    groupManager.allow(group, clientId, client);
  }

  /**
   * Leave a group. Group owners can not leave. Also used to reject invitation to
   * join the group.
   */
  @PostMapping("/{groupId}/leave")
  public void leave(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
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
  public void kick(@PathVariable String groupId, String clientId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Group kick, user: " + client + " group: " + group);
    groupManager.kick(group, clientId, client);
  }

  /**
   * Write something to a group. Online users are notified right away over the web
   * socket, offline users may get web push notification, if these are configured.
   * 
   * @param groupId The group
   * @param text    The message
   * @return message UUID
   */
  @PostMapping("/{groupId}/write")
  public String write(@PathVariable String groupId, @RequestBody String text, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    // FIXME sanitize text
    log.debug("Group write, user: " + client + " group: " + group + " text: " + text);
    return groupManager.write(client, group, text);
  }

  /**
   * Share a world link with the group. Online users are notified right away over
   * the web socket, offline users may get web push notification, if these are
   * configured.
   * 
   * @param groupId    The group
   * @param worldShare The message containing url and name of the world in link
   *                   and content fields
   */
  @PostMapping("/{groupId}/share")
  public void shareWorld(@PathVariable String groupId, @RequestBody GroupMessage worldShare, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    // FIXME sanitize text
    log.debug("Group share world, user: " + client + " group: " + group + " worldShare: " + worldShare);
    groupManager.worldInvite(client, group, worldShare.getContent(), worldShare.getLink());
  }

  /**
   * List pending requests to join the group. Only group owners can do that.
   * 
   * @param groupId
   */
  @GetMapping("/{groupId}/requests")
  public List<GroupMember> listRequests(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Group requests, user: " + client + " group: " + group);
    return groupManager.pendingRequests(group, client);
  }

  /**
   * List pending invitations to groups for the current user.
   */
  @GetMapping("/invitations")
  public List<GroupMember> listInvites(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Group invites, user: " + client);
    return groupManager.pendingInvitations(client);
  }

  /**
   * List groups containing unread messages.
   * 
   * @return List of groups having unread messages
   */
  @GetMapping("/unread")
  public List<UserGroup> listUnreadGroups(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Unread groups, user: " + client);
    return groupManager.unreadGroups(client);
  }

  /**
   * List unread messages for the group
   * 
   * @param groupId group identifier
   * @return List of unread messages in the group
   */
  @GetMapping("/{groupId}/unread")
  public List<GroupMessage> listUnreadMessages(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Unread messages, user: " + client + " group: " + group);
    List<GroupMessage> ret = groupManager.unreadMessages(client, group);
    return ret;
  }

  /**
   * List owners of a group. Needed e.g. to ask to join a private group.
   * 
   * @param groupId group identifier
   * @return List of users owning the group
   */
  @GetMapping("/{groupId}/owners")
  public List<Client> listOwners(@PathVariable String groupId, HttpSession session) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    log.debug("Unread messages, user: " + client + " group: " + group);
    return groupManager.listOwners(group);
  }

  /**
   * Add an attachment to a message: upload file to the server, and notify all
   * message recipients.
   * 
   * @param fileName
   * @param contentType
   * @param groupId
   * @param messageId
   * @param fileData
   */
  @PutMapping("/{groupId}/{messageId}/attachment")
  public void attach(HttpSession session, String fileName, String contentType, @PathVariable String groupId,
      @PathVariable String messageId, @RequestPart MultipartFile fileData) {

    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);

    String path = FileUtil.attachmentDir();
    Long fileSize = fileData.getSize();
    File dest = new File(path + File.separator + fileName);
    dest.mkdirs();

    log.debug("uploading attachment " + groupId + "/" + messageId + contentType + "/" + fileData.getContentType()
        + " to " + dest + " size " + fileSize);

    try (InputStream inputStream = fileData.getInputStream()) {
      Files.copy(inputStream, dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
    } catch (Exception e) {
      log.error("Upload error", e);
    }

    Content content = new Content();
    content.setFileName(fileName);
    content.setFolder(path);
    content.setContentType(contentType);
    content.setLength(fileSize);

    groupManager.attach(client, group, messageId, content);
  }

  /**
   * Remove an attachment from a message. Removes the file from the server and
   * notifies all other clients.
   * 
   * @param fileName
   * @param groupId
   * @param messageId
   */
  @DeleteMapping("/{groupId}/{messageId}/attachment")
  public void detach(HttpSession session, String fileName, @PathVariable String groupId,
      @PathVariable String messageId) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    groupManager.detach(client, group, messageId, fileName);
  }

  /**
   * Get an attachment for a message. Only users that can read the message can do
   * that.
   * 
   * @param groupId
   * @param messageId
   * @param fileName
   * @return
   */
  @SuppressWarnings("resource")
  @GetMapping("/{groupId}/{messageId}/attachment/{fileName}")
  public StreamingResponseBody getAttachment(HttpSession session, HttpServletResponse response,
      @PathVariable String groupId, @PathVariable String messageId, @PathVariable String fileName) {
    Client client = getAuthorisedClient(session);
    UserGroup group = groupManager.getGroupById(client, groupId);
    Content content = groupManager.getAttachment(client, group, messageId, fileName);

    response.setContentType(content.getContentType());
    response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment;filename=\"" + content.getFileName() + "\"");

    File file = new File(content.getFolder(), content.getFileName());
    InputStream inputStream;
    try {
      // auto-closeable
      inputStream = new FileInputStream(file);
    } catch (FileNotFoundException e) {
      throw new IllegalStateException("File not found " + file, e);
    }

    return outputStream -> {
      int bytesRead;
      // 4MB buffer
      byte[] buffer = new byte[4 * 1024 * 1024];
      while ((bytesRead = inputStream.read(buffer)) != -1) {
        outputStream.write(buffer, 0, bytesRead);
      }
    };
  }

}
