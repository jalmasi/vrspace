package org.vrspace.server.api;

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
import org.vrspace.server.dto.Recording.RecordingData;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.EventRecorder;

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
   * Save current recording.
   * 
   * @param recorderName unique name of the recorder to save
   * @return serialized events
   */
  @GetMapping("save")
  public RecordingData save(String recorderName, HttpSession session) {
    Client client = findClient(session);
    ClientResponse res = new Recording(recorderName, "save").execute(worldManager, client);
    RecordingData ret = (RecordingData) res.getResponse();
    return ret;
  }

  /**
   * Load an existing recording.
   * 
   * @param recorderName unique name of the recorder to be created after load
   * @param data         recording data serialized to json with save
   */
  @PutMapping("load")
  public void load(String recorderName, @RequestBody RecordingData data, HttpSession session) {
    Client client = findClient(session);
    EventRecorder eventRecorder = Recording.getRecorder(worldManager, client, recorderName);
    data.getEvents().forEach(event -> {
      if ("own".equals(event.getType())) {
        event.setSource(eventRecorder);
        try {
          // ensure it can be persisted
          event.setPayload(mapper.writeValueAsString(event));
        } catch (Exception e) {
          log.error("Can't load recorded message " + event);
        }
      }
    });
    eventRecorder.setLength(data.getLength());
    eventRecorder.setEvents(data.getEvents());
    worldManager.save(eventRecorder);
    client.getScene().dirty();
    client.getScene().update();
  }

}
