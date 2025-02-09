package org.vrspace.server.obj;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.ToString;

/**
 * Represents a membership of a user in a group
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@NoArgsConstructor
@RequiredArgsConstructor
@JsonInclude(Include.NON_EMPTY)
public class GroupMember extends Entity {
  @Relationship(type = "IS_MEMBER_OF", direction = Relationship.Direction.OUTGOING)
  @NonNull
  private UserGroup group;
  @Relationship(type = "MEMBER_CLIENT", direction = Relationship.Direction.OUTGOING)
  @NonNull
  private Client client;
  /** Pending invitation, if any */
  private String pendingInvite;
  /** Pending request to join, if any */
  private String pendingRequest;
  /**
   * Time stamp of last membership update, be it invite, request, or joining the
   * group
   */
  private Instant lastUpdate = Instant.now();

  public boolean joined() {
    return pendingInvite == null && pendingRequest == null;
  }

  /**
   * Set pendingInvite to random UUID, update the timestamp.
   * 
   * @return this
   */
  public GroupMember invite() {
    setPendingInvite(UUID.randomUUID().toString());
    setLastUpdate(Instant.now());
    return this;
  }

  /**
   * Set pendingRequest to random UUID, update the timestamp
   * 
   * @return this
   */
  public GroupMember request() {
    setPendingRequest(UUID.randomUUID().toString());
    setLastUpdate(Instant.now());
    return this;
  }

  /**
   * Set pending invite and request to null, update timestamp
   * 
   * @return this
   */
  public GroupMember accepted() {
    setPendingInvite(null);
    setPendingRequest(null);
    setLastUpdate(Instant.now());
    return this;
  }
}
