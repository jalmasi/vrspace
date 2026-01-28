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
import org.vrspace.server.connect.ollama.SceneAgent;
import org.vrspace.server.connect.ollama.SearchAgent;
import org.vrspace.server.connect.ollama.SearchAgent.SearchAgentResponse;
import org.vrspace.server.obj.Client;

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
  // CHECKE: we could share memory between agents
  public static final String SEARCH_MEMORY_ATTRIBUTE = "search-memory";
  public static final String SCENE_MEMORY_ATTRIBUTE = "scene-memory";

  @Autowired(required = false)
  private OllamaConfig config;
  @Autowired(required = false)
  private SearchAgent searchAgent;
  @Autowired(required = false)
  private SceneAgent sceneAgent;

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
    ChatMemory memory = getMemory(session, SEARCH_MEMORY_ATTRIBUTE);
    return ResponseEntity.ok(searchAgent.query(query, memory, session.getId()));
  }

  @PostMapping("/scene")
  public ResponseEntity<String> sceneAgent(HttpSession session, @RequestBody String query) {
    if (sceneAgent == null) {
      return new ResponseEntity<String>(HttpStatus.NOT_FOUND);
    }
    // ensure that the client is connected, otherwise every query creates new
    // session/conversation
    Client client = findClient(session);
    ChatMemory memory = getMemory(session, SCENE_MEMORY_ATTRIBUTE);
    return ResponseEntity.ok(sceneAgent.query(client, query, memory, session.getId()));
  }

  private ChatMemory getMemory(HttpSession session, String memoryAttribute) {
    ChatMemory memory = (ChatMemory) session.getAttribute(memoryAttribute);
    if (memory == null && config.getMemorySize() > 0) {
      log.debug("New chat memory " + memoryAttribute + " created, size " + config.getMemorySize());
      memory = MessageWindowChatMemory
          .builder()
          .maxMessages(config.getMemorySize())
          .chatMemoryRepository(repository(session))
          .build();
      session.setAttribute(memoryAttribute, memory);
    }
    return memory;
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
