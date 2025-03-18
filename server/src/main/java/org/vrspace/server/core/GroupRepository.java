package org.vrspace.server.core;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.context.annotation.DependsOn;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Entity;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.GroupMessage;
import org.vrspace.server.obj.UserGroup;

@DependsOn({ "database" })
public interface GroupRepository extends Neo4jRepository<Entity, Long>, VRSpaceDB {

  // TODO all these group related methods need to go to their own repo
  @Query("MATCH (ug:UserGroup)<-[owned:IS_OWNED]-(o:Ownership)-[owns:IS_OWNER]->(c:Client)"
      + " WHERE ID(c) = $clientId RETURN o,owns,c,owned,ug ORDER BY ug.name")
  List<UserGroup> listOwnedGroups(long clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(c)=$clientId AND gm.pendingInvite IS NULL AND gm.pendingRequest IS NULL RETURN ug ORDER BY ug.name")
  List<UserGroup> listUserGroups(long clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(c)=$clientId AND gm.pendingInvite IS NULL AND gm.pendingRequest IS NULL RETURN gm, r, ug ORDER BY ug.name")
  List<GroupMember> listGroupMemberships(long clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(ug)=$groupId AND gm.pendingRequest IS NULL AND gm.pendingInvite IS NULL RETURN c")
  List<Client> listGroupClients(long groupId);

  @Query("MATCH (gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(ug)=$groupId AND gm.pendingRequest IS NULL AND gm.pendingInvite IS NULL RETURN gm, r, ug")
  List<GroupMember> listGroupMembers(long groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(ug)=$groupId AND ID(c)=$clientId RETURN gm, c, mc, r, ug")
  Optional<GroupMember> findGroupMember(long groupId, long clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(c)=$clientId AND ug.name=$groupName RETURN ug")
  Optional<UserGroup> findGroup(long clientId, String groupName);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(c)=$clientId AND ID(ug)=$groupId RETURN ug")
  Optional<UserGroup> findGroup(long clientId, long groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE AND ug.name=$groupName RETURN ug")
  Optional<UserGroup> findGroup(String groupName);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ID(ug)=$groupId AND gm.pendingRequest IS NOT NULL RETURN gm, c, mc, r, ug")
  List<GroupMember> listPendingRequests(long groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup), (s:Client)<-[sc:SPONSOR_CLIENT]-(gm:GroupMember) WHERE ID(c)=$clientId AND gm.pendingInvite IS NOT NULL RETURN gm, c, mc, r, ug, sc, s ORDER BY ug.name")
  List<GroupMember> listPendingInvitations(long clientId);

  @Query("MATCH (msg:GroupMessage)-[r:PARENT_GROUP]->(ug:UserGroup) WHERE ID(ug)=$groupId AND ($since IS NULL OR msg.timestamp >= $since) return count(msg)")
  Integer unreadMessageCount(long groupId, Instant since);

  @Query("MATCH (c:Client)<-[mc:SENDER_CLIENT]-(msg:GroupMessage)-[r:PARENT_GROUP]->(ug:UserGroup) WHERE ID(ug)=$groupId AND ($since IS NULL OR msg.timestamp >= $since) return msg, mc, c ORDER BY msg.timestamp")
  List<GroupMessage> messagesSince(long groupId, Instant since);
}
