package org.vrspace.server.connect;

import java.net.MalformedURLException;
import java.util.List;
import java.util.Map;

import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.content.Media;
import org.springframework.ai.document.Document;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
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

/**
 * Component that connects to Ollama, and provides services and tools to agents, bots, and other components. It can generate
 * image description from the image of a 3D model, and store it to local vector database for later search. Image processing is
 * done asynchronously, one by one, and optionally paused during search, to keep down resource consumption. Models used for
 * images and tool calls (search) are configured in properties file, and can be different, or the same one.
 * 
 * @author joe
 *
 */
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
  @Autowired
  private VectorStore store;

  private OllamaChatModel visionChatModel;

  private OllamaChatModel toolsChatModel;

  private PausableThreadPoolExecutor imageProcessing = PausableThreadPoolExecutor.newSingleThreadExecutor();
  private PausableThreadPoolExecutor vectorSaving = PausableThreadPoolExecutor.newSingleThreadExecutor();

  private boolean shouldPause = true;

  /**
   * Describe the image: issue API call to Ollama vision model, and post-process the image.
   * 
   * @param url image URL
   * @return generated and post-processed description
   */
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

  /**
   * Passed as a post-processing function to sketchfab connector search. Adds a task to image processing executor that processes
   * the image with vision model, and asynchronously saves generated description of the model to the object and vector
   * databases.
   */
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
          db.save(model);
        } else {
          model.setDescription(description);
          model.setProcessed(true);
          db.save(model);
          vectorSaving.execute(() -> {
            save(model);
          });
        }
      } catch (Exception e) {
        log.warn("Processing failed " + e);
      }
    });
  }

  private void save(GltfModel model) {
    if (!imageProcessing.isShutdown()) {
      // if it's shut down already this only produces error
      try {
        Map<String, Object> metadata = Map.of("id", model.getId());
        Document doc = new Document(model.getId(), trimDescription(model.getDescription()), metadata);
        store.add(List.of(doc));
      } catch (Exception e) {
        log.warn("Vector document saving failed ", e);
      }
    }
  }

  /**
   * Returns configured vision model.
   */
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

  /**
   * Returns configured tools model.
   */
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

  /**
   * Stop image processing to speed up general chat.
   */
  public void stopImageProcessing() {
    if (shouldPause) {
      imageProcessing.pause();
      vectorSaving.pause();
      log.debug("Image processing paused");
    }
  }

  /**
   * (Re)start stopped image processing.
   */
  public void startImageProcessing() {
    if (shouldPause) {
      vectorSaving.resume();
      imageProcessing.resume();
      log.debug("Image processing resumed");
    }
  }

  @PreDestroy
  public void shutdown() {
    imageProcessing.shutdownNow();
    vectorSaving.shutdownNow();
  }

  @Tool(description = "Sketchfab 3D model search web API")
  public String sketchfabSearch(
      @ToolParam(description = "Search keywords") String keywords,
      @ToolParam(description = "Maximum model size, in megabytes") Integer maxSize,
      @ToolParam(description = "Request only animated models") Boolean animated,
      @ToolParam(description = "Request only rigged models") Boolean rigged,
      @ToolParam(description = "Maximum number of results") Integer maxResults) {
    log
        .info("Sketchfab search: " + keywords + " maxSize=" + maxSize + " maxResults=" + maxResults + " animated: " + animated
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
        req.setArchives_max_size(fixSize(maxSize));
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
          } else {
            req.setCursor(Integer.parseInt(response.getCursors().getNext()));
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
    log.debug("Sketchfab text size: " + models.length());
    return models;
  }

  @Tool(description = "Search local vector database for known 3D models")
  public String localSearch(
      @ToolParam(description = "Search query") String query,
      @ToolParam(description = "Maximum model size, in megabytes") Integer maxSize,
      @ToolParam(description = "Request only animated models") Boolean animated,
      @ToolParam(description = "Request only rigged models") Boolean rigged,
      @ToolParam(description = "Maximum number of results") Integer maxResults) {
    log
        .info("Local search: " + query + " maxSize=" + maxSize + " maxResults=" + maxResults + " animated: " + animated
            + " rigged: " + rigged);
    maxSize = fixSize(maxSize);
    StringBuilder ret = new StringBuilder();
    SearchRequest request = SearchRequest.builder().query(query).topK(maxResults).build();
    List<Document> docs = store.similaritySearch(request);
    int totalResults = 0;
    for (Document doc : docs) {
      GltfModel model = db.get(GltfModel.class, doc.getId());
      if (maxSize != null && maxSize < model.getLength()) {
        continue;
      }
      if (animated != null && animated && (model.getAnimated() == null || !model.getAnimated())) {
        // CHECKME: false?
        continue;
      }
      if (rigged != null && rigged && (model.getRigged() == null || !model.getRigged())) {
        // CHECKME: false?
        continue;
      }
      ret.append("UID: ");
      ret.append(model.getUid());
      ret.append(" Author: ");
      ret.append(model.getAuthor());
      ret.append(" Description: ");
      ret.append(trimDescription(model.getDescription()));
      ret.append("\n");
      totalResults++;
    }
    if (totalResults == 0) {
      ret.append("no models found that match all criteria");
    }
    String models = ret.toString();
    // log.debug("Models found: " + models);
    log.debug("Local text size: " + models.length());
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

  private Integer fixSize(Integer maxSize) {
    if (maxSize != null) {
      while (maxSize > 1000) {
        log.warn("maxSize=" + maxSize + ", fixing");
        maxSize = maxSize / 1000;
      }
      return maxSize * 1024 * 1024;
    }
    return null;
  }
}
