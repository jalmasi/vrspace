package org.vrspace.server.obj;

import java.util.Map;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaChatOptions;
import org.springframework.ai.ollama.api.common.OllamaApiConstants;
import org.springframework.ai.template.st.StTemplateRenderer;
import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

@Slf4j
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class OllamaBot extends Bot {
  // CHECKME all of these are transient and ignored
  // we may want to persist or publish some
  @JsonIgnore
  @Transient
  private transient String modelName = "ministral-3:3b";
  @JsonIgnore
  @Transient
  private OllamaChatModel chatModel;
  @JsonIgnore
  @Transient
  private int contextWindowSize = 65536;
  @JsonIgnore
  @Transient
  private String keepAlive = "1m";
  @JsonIgnore
  @Transient
  private int memorySize = 11;
  @JsonIgnore
  @Transient
  private SystemMessage systemMessage = new SystemMessage("""
          You are VirBot, a friendly chatbot in a virtual world.
          The context contains user information.
      """);
  @JsonIgnore
  @Transient
  private PromptTemplate promptTemplate = PromptTemplate
      .builder()
      .renderer(StTemplateRenderer.builder().startDelimiterToken('<').endDelimiterToken('>').build())
      .template("""
              Query: <query>

              Context:
              --------------------
              <context>
              --------------------
          """)
      .build();
  @JsonIgnore
  @Transient
  private ChatMemory memory;
  @JsonIgnore
  @Transient
  private String conversationId;
  @JsonIgnore
  @Transient
  private volatile boolean processing = false;

  @Override
  public void selfTest() throws Exception {
    if (getUrl() == null) {
      setUrl(OllamaApiConstants.DEFAULT_BASE_URL);
    }
    // TODO process parameterMap, getParameter()
    chatModel = OllamaChatModel
        .builder()
        .ollamaApi(OllamaApi.builder().baseUrl(getUrl()).build())
        .defaultOptions(
            OllamaChatOptions.builder().numCtx(getContextWindowSize()).model(getModelName()).keepAlive(getKeepAlive()).build())
        .build();
    memory = MessageWindowChatMemory
        .builder()
        .maxMessages(getMemorySize())
        .chatMemoryRepository(new InMemoryChatMemoryRepository())
        .build();
    conversationId = this.getId();
  }

  @Override
  public Mono<String> getResponseAsync(Client c, String query) {
    log.debug("Query from " + c.getId() + " " + query);
    String context = "Query from User " + c.getId() + " Name " + c.getName();
    String message = promptTemplate.render(Map.of("query", query, "context", context));
    memory.add(conversationId, systemMessage);
    memory.add(conversationId, new UserMessage(message));

    if (processing) {
      return Mono.just(null);
    } else {
      return Mono.create((sink) -> {
        try {
          processing = true;
          long time = System.currentTimeMillis();
          Prompt prompt = Prompt.builder().messages(memory.get(conversationId)).build();
          ChatResponse response = chatModel.call(prompt);
          time = System.currentTimeMillis() - time;
          log.debug("Response in " + time + " ms: \n" + response);
          memory.add(conversationId, response.getResult().getOutput());
          processing = false;
          sink.success(response.getResult().getOutput().getText());
        } catch (Exception e) {
          processing = false;
          log.error("Exception processing user query " + query, e);
          sink.error(e);
        }
      });
    }
  }

}
