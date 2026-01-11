package org.vrspace.server.connect.ollama;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
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
public class SearchAgent {
  @Autowired
  private OllamaConnector ollama;
  @Autowired
  private SketchfabConnector sketchfab;
  @Autowired
  private VRObjectRepository db;

  private SystemMessage systemMessage = new SystemMessage("""
          You are search engine for 3D models.
          Analyze the user query, and search sketchfab by best keywords. Use singular rather than plural.
          Analyze description of each model found, and return UID for each model that match the user query.
      """);
  private Pattern answerPattern = Pattern.compile("(.*)\\n");
  private Pattern answerCleanup = Pattern.compile("[^\\p{Punct}\\p{IsAlphabetic}\\p{IsDigit}\\s:]|\\n");
  private Pattern uidPattern = Pattern.compile("([a-zA-Z0-9]{32})");

  @Data
  @NoArgsConstructor
  public static class SearchAgentResponse {
    private String answer;
    private int size = 0;
    private List<GltfModel> models = new ArrayList<>();
    private boolean success = false;
  }

  public SearchAgentResponse query(String query, ChatMemory memory) {
    log.info("SearchAgent query " + query);
    SearchAgentResponse ret = new SearchAgentResponse();
    try {
      ollama.stopImageProcessing(5000);
      long time = System.currentTimeMillis();
      Prompt prompt = Prompt.builder().messages(systemMessage, new UserMessage(query))
          .chatOptions(OllamaChatOptions.builder().toolCallbacks(ToolCallbacks.from(this)).build()).build();
      ChatResponse response = ollama.toolsModel().call(prompt);
      time = System.currentTimeMillis() - time;
      log.debug("Response in " + time + " ms: " + response);

      String answer = response.getResult().getOutput().getText();

      Matcher answerMatcher = answerPattern.matcher(answer);
      if (answerMatcher.find()) {
        ret.answer = answerCleanup.matcher(answerMatcher.group()).replaceAll("");
      }

      Matcher uidMatcher = uidPattern.matcher(answer);
      time = System.currentTimeMillis();
      while (uidMatcher.find()) {
        String uid = uidMatcher.group();
        Optional<GltfModel> model = db.findGltfModelByUid(uid);
        if (model.isPresent()) {
          ret.models.add(model.get());
        } else {
          log.error("Model not found: " + uid);
        }
      }
      time = System.currentTimeMillis() - time;
      log.debug("Loaded " + ret.models.size() + " models in " + time + " ms");

      ret.size = ret.models.size();
      ret.success = ret.size > 0;
      ollama.startImageProcessing();
    } catch (Exception e) {
      ret.answer = e.toString();
    }
    return ret;
  }

  @Tool
  public String sketchfabSearch(String keywords) {
    log.info("SearchAgent search " + keywords);
    ModelSearchRequest req = new ModelSearchRequest();
    req.setQ(keywords);
    StringBuilder ret = new StringBuilder();
    try {
      long time = System.currentTimeMillis();
      ModelSearchResponse response = sketchfab.searchModels(req);
      time = System.currentTimeMillis() - time;
      log.debug("Found " + response.getResults().size() + " models in " + time + " ms");
      response.getResults().forEach(model -> {
        ret.append("UID: ");
        ret.append(model.getUid());
        ret.append(" Author: ");
        ret.append(model.getUser().getUsername());
        ret.append(" Description: ");
        ret.append(trimDescription(model.getDescription()));
        ret.append("\n");
      });
      ;
    } catch (Exception e) {
      log.error("Error searching for " + keywords, e);
      ret.append("ERROR");
    }
    String models = ret.toString();
    // log.debug("Models found: " + models);
    log.debug("Text size: " + models.length());
    return models;
  }

  private String trimDescription(String description) {
    if (description.length() > 1024) {
      log.warn("TODO: description size " + description.length() + " " + description);
    }
    return description;
  }
}
