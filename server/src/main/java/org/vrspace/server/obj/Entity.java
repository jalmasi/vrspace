package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * This is whatever we need to store to the database. Should be abstract class
 * but Neo4J doesn't allow it.
 *
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Entity {
  @Id
  @GeneratedValue
  @EqualsAndHashCode.Include
  private Long id;
}
