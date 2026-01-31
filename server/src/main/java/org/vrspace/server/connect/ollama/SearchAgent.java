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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.connect.OllamaConnector;
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
  private VRObjectRepository db;

  private SystemMessage systemMessage = new SystemMessage("""
          You are a search engine for 3D models.
          Search sketchfab using up to 3 best keywords from the user query. Use singular rather than plural.
          Analyze description of each model found, and return UID for each model that match the user query.
          Try to find 24 matching models.
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
      // no it does not
      if (memory.get(conversationId).size() == 0) {
        memory.add(conversationId, systemMessage);
      }
      memory.add(conversationId, new UserMessage(query));
      long time = System.currentTimeMillis();
      Prompt prompt = Prompt
          .builder()
          .messages(memory.get(conversationId))
          .chatOptions(
              OllamaChatOptions.builder().toolCallbacks(ToolCallbacks.from(ollama)).toolNames("sketchfabSearch").build())
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

}
