package org.vrspace.server.obj;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * Entity that hides it's ID from JSON - useful for member variables that need
 * to be persisted, but cannot exist without their parent object. This is really
 * workaround for lack of @Embedded annotation, which Neo4j doesn't support. All
 * Embedded member variables additionally have to be marked with @JsonMerge, or
 * Jackson creates new instance during merging on update! That results in
 * trashing the database, since embedded objects with null ID are created anew
 * in the database, while old ones are not deleted. So, IMPORTANT: mark all
 * Embedded fields with @JsonMerge, or else!
 */
public abstract class Embedded extends Entity {
  @JsonIgnore
  public Long getId() {
    return super.getId();
  }
}
