package org.vrspace.server.connect;

import java.net.MalformedURLException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.content.Media;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.GltfModel;

import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class OllamaConnector {
  @Autowired
  private VRObjectRepository db;

  private String visionModel = "granite3.2-vision";
  private String visionPrompt = "describe this";
  private OllamaChatModel visionChatModel;
  private Pattern descriptionCleanup = Pattern
      .compile("The image (depicts|displays|shows|appears to be|features)\\s?|\\r?\\n| of the image", Pattern.CASE_INSENSITIVE);
  private Pattern fail = Pattern.compile("unanswerable", Pattern.CASE_INSENSITIVE);

  private ExecutorService imageProcessing = Executors.newSingleThreadExecutor();

  public String describeImage(String url) {
    UserMessage userMessage;
    try {
      userMessage = UserMessage.builder().text(visionPrompt).media(new Media(MimeTypeUtils.IMAGE_JPEG, new UrlResource(url)))
          .build();
    } catch (MalformedURLException e) {
      log.error("Invalid url: " + url + " - " + e);
      return null;
    }

    long time = System.currentTimeMillis();
    String description = visionModel().call(userMessage);
    time = System.currentTimeMillis() - time;
    if (fail.matcher(description).find()) {
      log.error("Processing failed in " + time + "ms");
      return null;
    }
    description = descriptionCleanup.matcher(description).replaceAll("");// .replaceAll("\\r?\\n", " ");
    description = StringUtils.capitalize(description);
    int size = description.length();
    log.debug(time + "ms, " + size + ": " + description);
    return description;
  }

  public void updateDescriptionFromThumbnail(GltfModel model) {
    imageProcessing.execute(() -> {
      if (model.getProcessed() != null && model.getProcessed().booleanValue()) {
        // multiple search requests may enqueue the same model
        log.debug("Already processed model skipped: " + model);
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
    });

  }

  private OllamaChatModel visionModel() {
    if (visionChatModel == null) {
      visionChatModel = OllamaChatModel.builder().ollamaApi(OllamaApi.builder().build())
          .defaultOptions(OllamaChatOptions.builder().model(visionModel).build()).build();
    }
    return visionChatModel;
  }
}
