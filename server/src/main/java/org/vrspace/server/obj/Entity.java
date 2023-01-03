package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;

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
  @GeneratedValue
  @EqualsAndHashCode.Include
  private Long id;
}
