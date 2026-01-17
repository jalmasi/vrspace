package org.vrspace.server.config;

import java.util.regex.Pattern;

import org.springframework.ai.ollama.api.common.OllamaApiConstants;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

import lombok.Data;

@ConditionalOnProperty(name = "org.vrspace.ollama.enabled", havingValue = "true")
@Data
@Configuration("ollamaConfig")
public class OllamaConfig {
  private String url = OllamaApiConstants.DEFAULT_BASE_URL;
  // private String visionModel = "ibm/granite3.3-vision:2b";
  private String visionModel = "ministral-3";
  private String visionPrompt = "describe this";
  // TODO: A 3D model|A three-dimensional model of what appears to be
  private Pattern descriptionCleanup = Pattern
      .compile("(The|This) (image|illustration) (you've provided |you provided |you've shared |you shared )?"
          + "(depicts|displays|shows|appears to be|features|presents|is|illustrates)( an| a)?( whimsical, stylized| stylized, whimsical| charming and whimsical)?"
          + "( 3D model| three-dimensional model| 3D rendering| digital rendering| digital painting| illustration| depiction)?"
          + "( of| that captures)?( what appears to be)?\\s?| of the image|(3d rendering of |3D-rendered )|\\r?\\n|\\*\\*",
          Pattern.CASE_INSENSITIVE);
  private Pattern fail = Pattern.compile("unanswerable", Pattern.CASE_INSENSITIVE);
  // private String toolsModel = "mistral-nemo";
  private String toolsModel = "ministral-3";
  // default numCtx is 2048, way too small
  // .numCtx(16384) - swapping with 3d graphics on
  // .numCtx(32768) - too much for 16G VRAM
  private int contextWindowSize = 8192;
  /** How long to keep the model in VRAM, -1 means forever, but must have duration */
  private String keepAlive = "-1m";
}
