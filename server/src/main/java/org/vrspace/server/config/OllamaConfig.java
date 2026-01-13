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
  private String visionModel = "granite3.2-vision";
  private String visionPrompt = "describe this";
  private Pattern descriptionCleanup = Pattern
      .compile("The image (depicts|displays|shows|appears to be|features)\\s?|\\r?\\n| of the image", Pattern.CASE_INSENSITIVE);
  private Pattern fail = Pattern.compile("unanswerable", Pattern.CASE_INSENSITIVE);
  private String toolsModel = "mistral-nemo";
  // default numCtx is 2048, way too small
  // .numCtx(16384) - swapping with 3d graphics on
  // .numCtx(32768) - too much for 16G VRAM
  private int contextWindowSize = 8192;
}
