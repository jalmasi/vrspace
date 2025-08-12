package org.vrspace.server.obj;

import java.time.Instant;

import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
//@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@NoArgsConstructor
@JsonInclude(Include.NON_EMPTY)
public class GroupMessage extends Entity {
  // @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include =
  // JsonTypeInfo.As.WRAPPER_OBJECT)
  @JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
  @Relationship(type = "SENDER_CLIENT", direction = Relationship.Direction.OUTGOING)
  private Client from;
  // @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include =
  // JsonTypeInfo.As.WRAPPER_OBJECT)
  @Relationship(type = "PARENT_GROUP", direction = Relationship.Direction.OUTGOING)
  private UserGroup group;
  /** Message content (text) */
  private String content;
  /**
   * URL shared, only one for the time being. May be relative (e.g. for local
   * worlds) or absolute (external)
   */
  private String link;
  /** World ID, used only for world invitations/shares */
  private String worldId;
  private Instant timestamp;
  /** Used along the link, true if the link points to a world on this server */
  private Boolean local;

  public GroupMessage(Client from, UserGroup group, String content, Instant timestamp) {
    this.from = from;
    this.group = group;
    this.content = content;
    this.timestamp = timestamp;
  }
}
