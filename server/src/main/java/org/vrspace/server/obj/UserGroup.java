package org.vrspace.server.obj;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.vrspace.server.types.Owned;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.ToString;

/**
 * Group of users.
 * 
 * @author joe
 *
 */
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@Owned
@NoArgsConstructor
@RequiredArgsConstructor
public class UserGroup extends Entity {
  @NonNull
  private String name;
  private boolean isPublic;
  private boolean temporary;
  @Transient
  private transient Integer unread;

  public UserGroup(String name, boolean isPublic, boolean isTemporary) {
    this.name = name;
    this.isPublic = isPublic;
    this.temporary = isTemporary;
  }

  @JsonIgnore
  public boolean isPrivate() {
    return !isPublic();
  }
}
