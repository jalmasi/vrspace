package org.vrspace.server.config;

import java.util.regex.Pattern;

import org.springframework.ai.ollama.api.common.OllamaApiConstants;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

import lombok.Data;

@ConditionalOnProperty(name = "org.vrspace.ollama.enabled", havingValue = "true")
@Data
@Configuration
public class OllamaConfig {
  private String url = OllamaApiConstants.DEFAULT_BASE_URL;
  // private String visionModel = "ibm/granite3.3-vision:2b";
  // private String visionModel = "ministral-3";
  private String visionModel = "ministral-3:3b";
  private String visionPrompt = "describe this";
  private Pattern descriptionRemove = Pattern
      .compile("\\r?\\n|\\*\\*|"
          + "(The|This) (image|illustration) (you've provided |you provided |you've shared |you shared )?"
          + "(depicts|displays|shows|appears to be|features|presents|is|illustrates)( an| a)?"
          + "( whimsical| stylized| charming| cartoonish)?(,| and| yet)?( whimsical| stylized| charming| cartoonish)?(,| and|, and| yet)?"
          + "( 3D| three-dimensional| 3D| digital)?( model| rendering| painting| illustration| depiction|-rendered)?"
          + "( of| that captures)?( what appears to be)?\\s?| of the image|(3d rendering of |3D-rendered )",
          Pattern.CASE_INSENSITIVE);
  private Pattern descriptionReplace = Pattern.compile("\\s+");
  private Pattern fail = Pattern.compile("unanswerable", Pattern.CASE_INSENSITIVE);
  // private String toolsModel = "mistral-nemo";
  // private String toolsModel = "ministral-3";
  private String toolsModel = "ministral-3:3b";
  // default numCtx is 2048, way too small
  // swapping with 3d graphics on and 7-8b model:
  // private int contextWindowSize = 8192;
  // too much for 16G VRAM with 7-8b model:
  // private int contextWindowSize = 16384;
  // useful with 3b model, takes about 8G VRAM:
  // private int contextWindowSize = 32768;
  // 11G VRAM with 3b model:
  private int contextWindowSize = 65536;
  /** How long to keep the model in VRAM, -1 means forever, but must have duration */
  private String keepAlive = "-1m";
  // query+response, +1 for system message
  private int memorySize = 11;
}
