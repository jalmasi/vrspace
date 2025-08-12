package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.support.UUIDStringGenerator;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

/**
 * This is whatever we need to store to the database.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Node
@ToString
public abstract class Entity {
  @Id
  @GeneratedValue(generatorClass = UUIDStringGenerator.class)
  // @GeneratedValue
  @EqualsAndHashCode.Include
  private String id;
  // private Long id;

  @JsonIgnore
  public ID getObjectId() {
    return new ID(this);
  }

  /**
   * Called while an object is being deleted. Used for cleanup tasks, e.g. removal
   * of created files etc.
   */
  public void dispose() {
  }

}
