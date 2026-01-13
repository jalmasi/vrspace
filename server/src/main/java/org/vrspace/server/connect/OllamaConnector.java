package org.vrspace.server.connect;

import java.net.MalformedURLException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

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
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.GltfModel;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@ConditionalOnBean(OllamaConfig.class)
public class OllamaConnector {
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private OllamaConfig config;

  private OllamaChatModel visionChatModel;

  private OllamaChatModel toolsChatModel;

  private ExecutorService imageProcessing = Executors.newSingleThreadExecutor();
  private LinkedBlockingQueue<Runnable> imageQueue = new LinkedBlockingQueue<>();

  public String describeImage(String url) {
    UserMessage userMessage;
    try {
      userMessage = UserMessage.builder().text(config.getVisionPrompt())
          .media(new Media(MimeTypeUtils.IMAGE_JPEG, new UrlResource(url))).build();
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
    description = config.getDescriptionCleanup().matcher(description).replaceAll("");
    description = StringUtils.capitalize(description);
    int size = description.length();
    log.debug(time + "ms, " + size + ": " + description);
    return description;
  }

  public void updateDescriptionFromThumbnail(GltfModel model) {
    Runnable task = () -> {
      if (model.getProcessed() != null && model.getProcessed().booleanValue()) {
        // multiple search requests may enqueue the same model
        // log.debug("Already processed model skipped: " + model);
        return;
      }
      String description = this.describeImage(model.getThumbnail());
      if (description == null) {
        log.error("Failed " + model);
        model.setFailed(true);
      } else {
        model.setDescription(description);
      }
      model.setProcessed(true);
      db.save(model);
    };
    if (imageProcessing.isShutdown()) {
      imageQueue.add(task);
    } else {
      imageProcessing.execute(task);
    }

  }

  public OllamaChatModel visionModel() {
    if (visionChatModel == null) {
      visionChatModel = OllamaChatModel.builder().ollamaApi(OllamaApi.builder().build())
          .defaultOptions(OllamaChatOptions.builder().model(config.getVisionModel()).build()).build();
    }
    return visionChatModel;
  }

  public OllamaChatModel toolsModel() {
    if (toolsChatModel == null) {
      toolsChatModel = OllamaChatModel.builder().ollamaApi(OllamaApi.builder().build()).defaultOptions(
          OllamaChatOptions.builder().numCtx(config.getContextWindowSize()).model(config.getToolsModel()).build()).build();
    }
    return toolsChatModel;
  }

  public void stopImageProcessing(int millis) throws InterruptedException {
    List<Runnable> tasks = imageProcessing.shutdownNow();
    tasks.forEach(t -> imageQueue.add(t));
    imageProcessing.awaitTermination(millis, TimeUnit.MILLISECONDS);
  }

  public void startImageProcessing() throws InterruptedException {
    imageProcessing = Executors.newSingleThreadExecutor();
    while (imageQueue.size() > 0) {
      imageProcessing.execute(imageQueue.take());
    }
  }

}
