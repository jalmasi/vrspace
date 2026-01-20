package org.vrspace.server.connect;

import java.net.MalformedURLException;

import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.content.Media;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.core.PausableThreadPoolExecutor;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.GltfModel;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@ConditionalOnBean(OllamaConfig.class)
public class OllamaConnector {
  @Autowired
  private OllamaConfig config;
  @Autowired
  private VRObjectRepository db;

  private OllamaChatModel visionChatModel;

  private OllamaChatModel toolsChatModel;

  private PausableThreadPoolExecutor imageProcessing = PausableThreadPoolExecutor.newSingleThreadExecutor();

  private boolean shouldPause = true;

  public String describeImage(String url) {
    UserMessage userMessage;
    try {
      userMessage = UserMessage
          .builder()
          .text(config.getVisionPrompt())
          .media(new Media(MimeTypeUtils.IMAGE_JPEG, new UrlResource(url)))
          .build();
    } catch (MalformedURLException e) {
      log.error("Invalid url: " + url + " - " + e);
      return null;
    }

    long time = System.currentTimeMillis();
    String description = visionModel().call(userMessage);
    time = System.currentTimeMillis() - time;
    if (config.getFail().matcher(description).find()) {
      log.error("Processing failed in " + time + "ms");
      return null;
    }
    String updatedDescription = StringUtils
        .capitalize(config
            .getDescriptionReplace()
            .matcher(config.getDescriptionRemove().matcher(description).replaceAll(""))
            .replaceAll(" "));
    int size = updatedDescription.length();
    log.debug("Processed " + url + " in " + time + "ms, " + size + ": \n" + description + "\n - " + updatedDescription);
    return updatedDescription;
  }

  public void updateDescriptionFromThumbnail(GltfModel model) {
    imageProcessing.execute(() -> {
      if (model.getProcessed() != null && model.getProcessed()) {
        // multiple search requests may enqueue the same model
        // log.debug("Already processed model skipped: " + model);
        return;
      } else if (model.getFailed() != null && model.getFailed()) {
        // log.debug("Already failed model skipped: " + model);
        return;
      }
      try {
        String description = this.describeImage(model.getThumbnail());
        if (description == null) {
          log.error("Failed " + model);
          model.setFailed(true);
        } else {
          model.setDescription(description);
          model.setProcessed(true);
        }
        if (!imageProcessing.isShutdown()) {
          // if it's shut down already this only produces error
          db.save(model);
        }
      } catch (Exception e) {
        log.warn("Processing failed " + e);
      }
    });

  }

  public OllamaChatModel visionModel() {
    if (visionChatModel == null) {
      visionChatModel = OllamaChatModel
          .builder()
          .ollamaApi(OllamaApi.builder().baseUrl(config.getUrl()).build())
          .defaultOptions(OllamaChatOptions.builder().model(config.getVisionModel()).keepAlive(config.getKeepAlive()).build())
          .build();
    }
    return visionChatModel;
  }

  public OllamaChatModel toolsModel() {
    if (toolsChatModel == null) {
      toolsChatModel = OllamaChatModel
          .builder()
          .ollamaApi(OllamaApi.builder().baseUrl(config.getUrl()).build())
          .defaultOptions(OllamaChatOptions
              .builder()
              .numCtx(config.getContextWindowSize())
              .model(config.getToolsModel())
              .keepAlive(config.getKeepAlive())
              .build())
          .build();
    }
    return toolsChatModel;
  }

  public void stopImageProcessing() {
    if (shouldPause) {
      imageProcessing.pause();
      log.debug("Image processing paused");
    }
  }

  public void startImageProcessing() {
    if (shouldPause) {
      imageProcessing.resume();
      log.debug("Image processing resumed");
    }
  }

  @PreDestroy
  public void shutdown() {
    imageProcessing.shutdownNow();
  }

}
