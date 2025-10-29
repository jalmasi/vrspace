package org.vrspace.server.api;

import java.util.Collection;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.dto.ClientResponse;
import org.vrspace.server.dto.Recording;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.EventRecorder;
import org.vrspace.server.obj.PersistentEvent;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Allows recording and playback of own avatar.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(Recorder.PATH)
public class Recorder extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/recorder";

  @Autowired
  WorldManager worldManager;
  @Autowired
  ObjectMapper mapper;

  /**
   * Do something with a recording: record, stop, play, delete
   * 
   * @param state Identifies recorder and action to perform.
   */
  @PostMapping("set")
  public void recording(Recording state, HttpSession session) {
    Client client = findClient(session);
    state.execute(worldManager, client);
  }

  /**
   * Save current recording. WARNING this may be huge.
   * 
   * @param recorderName unique name of the recorder to save
   * @return serialized events
   */
  @GetMapping("save")
  public Collection<PersistentEvent> save(String recorderName, HttpSession session) {
    Client client = findClient(session);
    ClientResponse res = new Recording(recorderName, "save").execute(worldManager, client);
    @SuppressWarnings("unchecked")
    Collection<PersistentEvent> events = (Collection<PersistentEvent>) res.getResponse();
    return events;
  }

  /**
   * Load an existing recording. WARNING this may be huge.
   * 
   * @param recorderName unique name of the recorder to save
   */
  @PutMapping("load")
  public void load(String recorderName, @RequestBody Collection<PersistentEvent> events, HttpSession session) {
    Client client = findClient(session);
    EventRecorder eventRecorder = Recording.getRecorder(worldManager, client, recorderName);
    events.forEach(event -> {
      if ("own".equals(event.getType())) {
        event.setSource(eventRecorder);
        try {
          // ensure it can be persisted
          event.setPayload(mapper.writeValueAsString(event.getChanges()));
        } catch (Exception e) {
          log.error("Can't load recorddec message " + event.getChanges());
        }
      }
    });
    eventRecorder.setEvents(events);
    worldManager.save(eventRecorder);
  }

}
