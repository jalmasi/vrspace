package org.vrspace.server.core;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import org.apache.http.HttpResponse;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.vrspace.server.dto.GroupEvent;
import org.vrspace.server.dto.WebPushMessage;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.GroupMessage;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.UserGroup;
import org.vrspace.server.obj.WebPushSubscription;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

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
  private GroupRepository groupRepo;
  @Autowired
  private WorldManager worldManager;
  @Autowired(required = false)
  private PushService pushService;
  @Autowired
  private ObjectMapper objectMapper;

  private static GroupManager instance;

  public static GroupManager getInstance() {
    return instance;
  }

  @PostConstruct
  public void init() {
    instance = this;
  }

  @Transactional
  public List<UserGroup> listGroups(Client client) {
    return groupRepo.listUserGroups(client.getId());
  }

  @Transactional
  public List<UserGroup> listOwnedGroups(Client client) {
    return groupRepo.listOwnedGroups(client.getId());
  }

  @Transactional
  public UserGroup createGroup(Client client, UserGroup group) {
    if (groupRepo.findGroup(client.getId(), group.getName()).isPresent()) {
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
    // delete messages
    groupRepo.messagesSince(group.getId(), null).forEach(groupMessage -> db.delete(groupMessage));
    // delete memberships
    groupRepo.listGroupMembers(group.getId()).forEach(groupMember -> db.delete(groupMember));
    // delete ownership(s)
    db.getOwnersOf(group.getId()).forEach(ownership -> db.delete(ownership));
    // and finally, delete the group
    db.delete(group);
  }

  @Transactional
  public List<Client> show(UserGroup group) {
    return groupRepo.listGroupClients(group.getId());
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
    if (groupRepo.findGroupMember(group.getId(), member.getId()).isPresent()) {
      throw new IllegalArgumentException("Client " + member.getId() + " is already member of group " + group.getId());
    }
    if (group.isPrivate() && (owner == null || db.findOwnership(owner.getId(), group.getId()).isEmpty())) {
      throw new IllegalArgumentException("Only group owners can invite members");
    }
    GroupMember gm = new GroupMember(group, member).invite(owner);
    save(gm);
    Client cachedClient = getCachedClient(member);
    if (cachedClient != null) {
      // online client, forward message
      // FIXME this serializes the message all over again for each recipient
      cachedClient.sendMessage(GroupEvent.invite(gm));
    } else if (pushService != null) {
      log.debug("Pushing invite for offline client:" + member);
      WebPushMessage msg = new WebPushMessage();
      msg.setType(WebPushMessage.Type.GROUP_INVITE);
      msg.setGroup(group.getName());
      msg.setSender(owner.getName());
      notify(member, msg);
    } else {
      log.debug("Invite for offline client:" + member);
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
    Optional<GroupMember> existingMember = groupRepo.findGroupMember(group.getId(), member.getId());
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
    if (groupRepo.findGroupMember(group.getId(), member.getId()).isPresent()) {
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
    Optional<GroupMember> invited = groupRepo.findGroupMember(group.getId(), member.getId());
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
      Optional<GroupMember> existing = groupRepo.findGroupMember(group.getId(), member.getId());
      if (existing.isPresent()) {
        throw new IllegalArgumentException("Already a member");
      }
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
    Optional<GroupMember> member = groupRepo.findGroupMember(group.getId(), memberId);
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
    return groupRepo.listPendingRequests(group.getId());
  }

  /**
   * Any user can list their own pending invitations
   * 
   * @param member
   * @return
   */
  @Transactional
  public List<GroupMember> pendingInvitations(Client member) {
    return groupRepo.listPendingInvitations(member.getId());
  }

  private void addMember(UserGroup group, Client member) {
    GroupMember gm = new GroupMember(group, member);
    save(gm);
  }

  private void removeMember(UserGroup group, Client member) {
    groupRepo.findGroupMember(group.getId(), member.getId()).ifPresent(groupMember -> db.delete(groupMember));
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

  private void write(Client sender, UserGroup group, WebPushMessage.Type type, GroupMessage groupMessage) {
    if (groupRepo.findGroupMember(group.getId(), sender.getId()).isEmpty()) {
      throw new SecurityException("Only members can post to groups");
    }
    GroupMessage message = db.save(groupMessage);
    groupRepo.listGroupClients(group.getId()).forEach(client -> {
      // CHECKME: client.isActive() should to the trick
      // but we need a reference to live client instance to send the message
      Client cachedClient = getCachedClient(client);
      if (cachedClient != null) {
        // online client, forward message
        // FIXME this serializes the message all over again for each recipient
        cachedClient.sendMessage(GroupEvent.message(message));
      } else if (pushService != null) {
        log.debug("Pushing message for offline client:" + client);
        WebPushMessage msg = new WebPushMessage();
        msg.setType(type);
        msg.setGroup(group.getName());
        msg.setSender(sender.getName());
        msg.setMessage(message.getContent());
        msg.setUrl(message.getLink());
        notify(client, msg);
      }
    });
  }

  @Transactional
  public void write(Client sender, UserGroup group, String text) {
    write(sender, group, WebPushMessage.Type.GROUP_MESSAGE, new GroupMessage(sender, group, text, Instant.now()));
  }

  @Transactional
  public void worldInvite(Client sender, UserGroup group, String text, String link) {
    GroupMessage msg = new GroupMessage(sender, group, text, Instant.now());
    msg.setLink(link);
    msg.setLocal(true);
    write(sender, group, WebPushMessage.Type.WORLD_INVITE, msg);
  }

  @Transactional
  public UserGroup getGroup(Client client, String name) {
    Optional<UserGroup> group = groupRepo.findGroup(client.getId(), name);
    if (group.isEmpty()) {
      throw new NotFoundException("Non-existing group: " + name + " clientId:" + client.getId());
    }
    return group.get();
  }

  @Transactional
  public UserGroup getGroup(Client client, long groupId) {
    Optional<UserGroup> group = groupRepo.findGroup(client.getId(), groupId);
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
    List<GroupMember> groups = groupRepo.listGroupMemberships(client.getId());
    groups.forEach((gm) -> {
      UserGroup group = gm.getGroup();
      int unread = groupRepo.unreadMessageCount(group.getId(), gm.getLastRead());
      group.setUnread(unread);
    });
    return groups.stream().map(gm -> gm.getGroup()).filter(g -> g.getUnread() > 0).collect(Collectors.toList());
  }

  @Transactional
  public List<GroupMessage> unreadMessages(Client client, UserGroup group) {
    Instant now = Instant.now();
    Optional<GroupMember> gm = groupRepo.findGroupMember(group.getId(), client.getId());
    if (gm.isEmpty()) {
      throw new NotFoundException("Not a group member: " + group.getId() + " clientId:" + client.getId());
    }
    GroupMember member = gm.get();
    Instant lastRead = member.getLastRead();
    member.setLastRead(now);
    save(member);
    return groupRepo.messagesSince(group.getId(), lastRead);
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
      log.debug("Client is not active " + c);
    }
    return cachedClient;
  }

  private void save(GroupMember gm) {
    db.save(gm);
    // log.debug(gm.getClient().getId() + " " + gm.getClient().getPosition());
  }

  private void notify(Client client, WebPushMessage msg) {
    db.listSubscriptions(client.getId()).forEach(sub -> {
      send(sub, msg);
    });
  }

  private void send(WebPushSubscription subscription, WebPushMessage message) {
    try {
      Notification notification = new Notification(subscription.getEndpoint(), subscription.getKey(),
          subscription.getAuth(), objectMapper.writeValueAsBytes(message));

      HttpResponse res = pushService.send(notification);
      log.debug("Notification sent:" + message + " to " + subscription.getEndpoint() + " result: " + res + " "
          + EntityUtils.toString(res.getEntity(), "UTF-8"));
      if (res.getStatusLine().getStatusCode() != 201) {
        // CHECKME: remove subscription?
        log.error("Push notification failed");
      }
    } catch (Exception e) {
      // CHECKME: remove subscription?
      log.error("Push notification failed", e);
    }
  }
}
