package org.vrspace.server.obj;

import org.springframework.data.neo4j.core.schema.Node;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonMerge;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.AccessLevel;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Setter;
import lombok.ToString;

@Data
@JsonInclude(Include.NON_EMPTY)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@Node
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
public class VRFile extends VRObject {
  public static final String FILE_SCRIPT = "/babylon/js/scripts/shared-file.js";
  public static final String IMAGE_SCRIPT = "/babylon/js/scripts/shared-image.js";
  public static final String VIDEO_SCRIPT = "/babylon/js/scripts/shared-video.js";

  @JsonMerge
  @Setter(AccessLevel.NONE)
  private Content content;

  public VRFile() {
    super();
    setScript(FILE_SCRIPT);
  }

  public void setContent(Content content) {
    this.content = content;
    if (content != null && content.getContentType() != null) {
      if (content.getContentType().contains("image/")) {
        setScript(IMAGE_SCRIPT);
      } else if (content.getContentType().equals("video/mp4") || content.getContentType().equals("video/ogg")
          || content.getContentType().equals("video/webm")) {
        setScript(VIDEO_SCRIPT);
      }
    }
  }
}
