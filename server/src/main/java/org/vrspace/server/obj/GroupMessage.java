package org.vrspace.server.obj;

import java.time.Instant;

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

@Data
//@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@NoArgsConstructor
@RequiredArgsConstructor
@JsonInclude(Include.NON_EMPTY)
public class GroupMessage extends Entity {
  // @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include =
  // JsonTypeInfo.As.WRAPPER_OBJECT)
  @Relationship(type = "SENDER_CLIENT", direction = Relationship.Direction.OUTGOING)
  @NonNull
  private Client from;
  // @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include =
  // JsonTypeInfo.As.WRAPPER_OBJECT)
  @Relationship(type = "PARENT_GROUP", direction = Relationship.Direction.OUTGOING)
  @NonNull
  private UserGroup group;
  @NonNull
  private String content;
  @NonNull
  private Instant timestamp;
}
