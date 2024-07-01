package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonMerge;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Data
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Slf4j
public class VRFile extends VRObject {
  public static final String FILE_SCRIPT = "/babylon/js/scripts/shared-file.js";

  @JsonMerge
  private Content content;

  public VRFile() {
    super();
    setScript(FILE_SCRIPT);
  }

}
