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
public interface GroupRepository extends Neo4jRepository<Entity, String>, VRSpaceDB {

  @Query("MATCH (ug:UserGroup)<-[owned:IS_OWNED]-(o:Ownership)-[owns:IS_OWNER]->(c:Client)"
      + " WHERE c.id = $clientId RETURN o,owns,c,owned,ug ORDER BY ug.name")
  List<UserGroup> listOwnedGroups(String clientId);

  // CHECKME this likely returns shallow client
  @Query("MATCH (ug:UserGroup)<-[owned:IS_OWNED]-(o:Ownership)-[owns:IS_OWNER]->(c:Client)"
      + " WHERE ug.id = $groupId RETURN o,owns,c,owned,ug")
  List<Client> listGroupOwners(String groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE c.id=$clientId AND gm.pendingInvite IS NULL AND gm.pendingRequest IS NULL RETURN ug ORDER BY ug.name")
  List<UserGroup> listUserGroups(String clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE c.id=$clientId AND gm.pendingInvite IS NULL AND gm.pendingRequest IS NULL RETURN gm, r, ug ORDER BY ug.name")
  List<GroupMember> listGroupMemberships(String clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ug.id=$groupId AND gm.pendingRequest IS NULL AND gm.pendingInvite IS NULL RETURN c")
  List<Client> listGroupClients(String groupId);

  @Query("MATCH (gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ug.id=$groupId AND gm.pendingRequest IS NULL AND gm.pendingInvite IS NULL RETURN gm, r, ug")
  List<GroupMember> listGroupMembers(String groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ug.id=$groupId AND c.id=$clientId RETURN gm, c, mc, r, ug")
  Optional<GroupMember> findGroupMember(String groupId, String clientId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE c.id=$clientId AND ug.name=$groupName RETURN ug")
  Optional<UserGroup> findGroupByName(String clientId, String groupName);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE c.id=$clientId AND ug.id=$groupId RETURN ug")
  Optional<UserGroup> findGroupById(String clientId, String groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE AND ug.name=$groupName RETURN ug")
  Optional<UserGroup> findGroupByName(String groupName);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup) WHERE ug.id=$groupId AND gm.pendingRequest IS NOT NULL RETURN gm, c, mc, r, ug")
  List<GroupMember> listPendingRequests(String groupId);

  @Query("MATCH (c:Client)<-[mc:MEMBER_CLIENT]-(gm:GroupMember)-[r:IS_MEMBER_OF]->(ug:UserGroup), (s:Client)<-[sc:SPONSOR_CLIENT]-(gm:GroupMember) WHERE c.id=$clientId AND gm.pendingInvite IS NOT NULL RETURN gm, c, mc, r, ug, sc, s ORDER BY ug.name")
  List<GroupMember> listPendingInvitations(String clientId);

  @Query("MATCH (msg:GroupMessage)-[r:PARENT_GROUP]->(ug:UserGroup) WHERE ug.id=$groupId AND ($since IS NULL OR msg.timestamp >= $since) return count(msg)")
  Integer unreadMessageCount(String groupId, Instant since);

  @Query("MATCH (c:Client)<-[mc:SENDER_CLIENT]-(msg:GroupMessage)-[r:PARENT_GROUP]->(ug:UserGroup) WHERE ug.id=$groupId AND ($since IS NULL OR msg.timestamp >= $since) return msg, mc, c ORDER BY msg.timestamp")
  List<GroupMessage> messagesSince(String groupId, Instant since);
}
