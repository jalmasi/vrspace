package org.vrspace.server.connect;

import java.net.MalformedURLException;

import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.content.Media;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.connect.sketchfab.ModelSearchRequest;
import org.vrspace.server.connect.sketchfab.ModelSearchResponse;
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
  @Autowired(required = false)
  private SketchfabConnector sketchfab;

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
    // log.debug("Processed " + url + " in " + time + "ms, size " + size + ": \n" + description + "\n - " + updatedDescription);
    log.debug("Processed " + url + " in " + time + "ms, size " + size);
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
          .defaultOptions(OllamaChatOptions
              .builder()
              .model(config.getVisionModel())
              .numCtx(config.getContextWindowSize())
              .keepAlive(config.getKeepAlive())
              .build())
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

  @Tool(description = "Sketchfab 3D model search web API")
  public String sketchfabSearch(
      @ToolParam(description = "Search keywords") String keywords,
      @ToolParam(description = "Maximum model size, in megabytes") Integer maxSize,
      @ToolParam(description = "Request only animated models") Boolean animated,
      @ToolParam(description = "Request only rigged models") Boolean rigged,
      @ToolParam(description = "Maximum number of results, default 24") Integer maxResults) {
    log
        .info("SearchAgent search: " + keywords + " maxSize=" + maxSize + " maxResults=" + maxResults + " animated: " + animated
            + " rigged: " + rigged);
    if (sketchfab == null) {
      return "Sketchfab unavailable";
    }
    // model can use comma rather than space:
    String[] keywordList = keywords.split(",");
    StringBuilder ret = new StringBuilder();
    int totalResults = 0;
    try {
      for (String keyword : keywordList) {
        ModelSearchRequest req = new ModelSearchRequest();
        req.setQ(keyword);
        if (maxSize != null) {
          while (maxSize > 1000) {
            log.warn("maxSize=" + maxSize + ", fixing");
            maxSize = maxSize / 1000;
          }
          req.setArchives_max_size(maxSize * 1024 * 1024);
        }
        if (maxResults == null) {
          maxResults = 24;
        } else {
          // we can set it, but let's prefetch some more
          // req.setCount(maxResults);
        }
        if (animated != null) {
          req.setAnimated(animated);
        }
        if (rigged != null) {
          req.setRigged(rigged);
        }
        int results = 0;
        while (results < maxResults) {
          long time = System.currentTimeMillis();
          ModelSearchResponse response = sketchfab.searchModels(req, model -> this.updateDescriptionFromThumbnail(model));
          time = System.currentTimeMillis() - time;
          log.debug("Found " + response.getResults().size() + " models in " + time + " ms");
          results += response.getResults().size();
          response.getResults().forEach(model -> {
            ret.append("UID: ");
            ret.append(model.getUid());
            ret.append(" Author: ");
            ret.append(model.getUser().getUsername());
            ret.append(" Description: ");
            ret.append(trimDescription(model.getDescription()));
            ret.append("\n");
          });
          // CHECKME: does adding tags/categories make sense?
          if (response.getNext() == null) {
            break;
          }
        }
        totalResults += results;
      }
    } catch (Exception e) {
      log.error("Error searching for " + keywords, e);
      ret.append("ERROR");
    }
    if (totalResults == 0) {
      ret.append("no models found that match all keywords");
    }
    String models = ret.toString();
    // log.debug("Models found: " + models);
    log.debug("Text size: " + models.length());
    return models;
  }

  private String trimDescription(String description) {
    int length = description.length();
    int limit = 2048;
    if (length > limit) {
      description = description.substring(0, limit - 1);
      int pos = description.lastIndexOf(".") + 1;
      description = description.substring(0, pos);
      log.warn("Description trimmed from " + length + " to " + description.length() + ":" + description);
    }
    return description;
  }

}
