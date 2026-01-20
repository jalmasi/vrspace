package org.vrspace.server.connect.ollama;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.connect.OllamaConnector;
import org.vrspace.server.connect.SketchfabConnector;
import org.vrspace.server.connect.sketchfab.ModelSearchRequest;
import org.vrspace.server.connect.sketchfab.ModelSearchResponse;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.GltfModel;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@ConditionalOnBean(OllamaConfig.class)
public class SearchAgent {
  @Autowired
  private OllamaConnector ollama;
  @Autowired
  private SketchfabConnector sketchfab;
  @Autowired
  private VRObjectRepository db;

  private SystemMessage systemMessage = new SystemMessage("""
          You are a search engine for 3D models.
          Search sketchfab using up to 3 best keywords from the user query. Use singular rather than plural.
          Analyze description of each model found, and return UID for each model that match the user query.
      """);
  private Pattern answerPattern = Pattern.compile("(.*)\\n");
  private Pattern answerCleanup = Pattern.compile("[^\\p{Punct}\\p{IsAlphabetic}\\p{IsDigit}\\s]|\\n");
  private Pattern uidPattern = Pattern.compile("([a-zA-Z0-9]{32})");

  @Data
  @NoArgsConstructor
  public static class SearchAgentResponse {
    private String answer;
    private int size = 0;
    // model can list an UID twice, e.g. as uid and as part of the link, so Set
    private Set<GltfModel> models = new HashSet<>();
    private boolean success = false;
  }

  public SearchAgentResponse query(String query, ChatMemory memory, String conversationId) {
    log.info("SearchAgent query: " + query);
    SearchAgentResponse ret = new SearchAgentResponse();
    ollama.stopImageProcessing();
    try {
      // memory makes sure to keep only one system message
      // if (memory.get(conversationId).size() == 0) {
      memory.add(conversationId, systemMessage);
      // }
      memory.add(conversationId, new UserMessage(query));
      long time = System.currentTimeMillis();
      Prompt prompt = Prompt
          .builder()
          .messages(memory.get(conversationId))
          .chatOptions(OllamaChatOptions.builder().toolCallbacks(ToolCallbacks.from(this)).build())
          .build();
      ChatResponse response = ollama.toolsModel().call(prompt);
      time = System.currentTimeMillis() - time;
      log.debug("Response in " + time + " ms: " + response);

      memory.add(conversationId, response.getResult().getOutput());
      String answer = response.getResult().getOutput().getText();

      Matcher uidMatcher = uidPattern.matcher(answer);
      time = System.currentTimeMillis();
      while (uidMatcher.find()) {
        String uid = uidMatcher.group();
        Optional<GltfModel> model = db.findGltfModelByUid(uid);
        if (model.isPresent()) {
          // requires Set
          ret.models.add(model.get());
        } else {
          log.error("Model not found: " + uid);
        }
      }
      time = System.currentTimeMillis() - time;
      log.debug("Loaded " + ret.models.size() + " models in " + time + " ms");

      ret.size = ret.models.size();
      ret.success = true;
      ret.answer = answer;
      if (ret.models.size() > 0) {
        Matcher answerMatcher = answerPattern.matcher(answer);
        if (answerMatcher.find()) {
          ret.answer = answerCleanup.matcher(answerMatcher.group()).replaceAll("");
        }
      }
    } catch (Exception e) {
      log.error("Failed to process query " + query, e);
      ret.answer = e.toString();
    } finally {
      ollama.startImageProcessing();
    }
    return ret;
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
          ModelSearchResponse response = sketchfab.searchModels(req);
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
