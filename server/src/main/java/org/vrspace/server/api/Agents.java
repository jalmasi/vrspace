package org.vrspace.server.api;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.config.OllamaConfig;
import org.vrspace.server.connect.ollama.SearchAgent;
import org.vrspace.server.connect.ollama.SearchAgent.SearchAgentResponse;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Communicate with AI agents in virtual worlds. Only available to clients in a world.
 * 
 * @author joe
 *
 */
@RestController
@RequestMapping(Agents.PATH)
@Slf4j
public class Agents extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/agents";
  public static final String MEMORY_REPOSITORY_ATTRIBUTE = "memory-repository";
  public static final String SEARCH_MEMORY_ATTRIBUTE = "search-memory";

  @Autowired(required = false)
  private SearchAgent searchAgent;
  @Autowired(required = false)
  private OllamaConfig config;

  /**
   * Sketchfab search agent.
   * 
   * @param query
   */
  @PostMapping("/search")
  public ResponseEntity<SearchAgentResponse> searchAgent(HttpSession session, @RequestBody String query) {
    if (searchAgent == null) {
      return new ResponseEntity<SearchAgentResponse>(HttpStatus.NOT_FOUND);
    }
    // ensure that the client is connected, otherwise every query creates new
    // session/conversation
    findClient(session);
    ChatMemory memory = (ChatMemory) session.getAttribute(SEARCH_MEMORY_ATTRIBUTE);
    if (memory == null) {
      log.debug("New chat memory created, size " + config.getMemorySize());
      memory = MessageWindowChatMemory
          .builder()
          .maxMessages(config.getMemorySize())
          .chatMemoryRepository(repository(session))
          .build();
      session.setAttribute(SEARCH_MEMORY_ATTRIBUTE, memory);
    }
    return ResponseEntity.ok(searchAgent.query(query, memory, session.getId()));
  }

  private ChatMemoryRepository repository(HttpSession session) {
    ChatMemoryRepository repository = (ChatMemoryRepository) session.getAttribute(MEMORY_REPOSITORY_ATTRIBUTE);
    if (repository == null) {
      repository = new InMemoryChatMemoryRepository();
      session.setAttribute(MEMORY_REPOSITORY_ATTRIBUTE, repository);
    }
    return repository;
  }
}
