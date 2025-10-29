package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.EventRecorder;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Command to start/stop/play recording of client's events.
 * 
 * @see EventRecorder
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@Slf4j
public class Recording implements Command {
  /** Recorder name, must be unique */
  private String name;
  /** Action: record, play, stop, delete */
  private String action;

  public ClientResponse execute(WorldManager worldManager, Client client) {
    if (this.name == null) {
      this.name = "Recorder:" + client.getId();
    }
    EventRecorder recorder = getRecorder(worldManager, client, this.name);
    if ("record".equals(this.action)) {
      recorder.init(worldManager, client);
      recorder.start();
    } else if ("play".equals(this.action)) {
      recorder.setLoop(true);
      recorder = worldManager.save(recorder);
      recorder.play();
    } else if ("stop".equals(this.action)) {
      recorder.setLoop(false);
      recorder.stop();
      recorder = worldManager.save(recorder);
      log.debug("Saved recorder " + recorder);
      // so that recorder reloads:
      client.getScene().dirty();
      client.getScene().update();
    } else if ("delete".equals(this.action)) {
      recorder.stop();
      worldManager.remove(client, recorder);
      // so that recorder reloads:
      client.getScene().dirty();
      client.getScene().update();
    } else if ("save".equals(this.action)) {
      return new ClientResponse(recorder.getEvents());
    } else {
      throw new IllegalArgumentException("Invalid action: " + action);
    }
    return null;
  }

  public static EventRecorder getRecorder(WorldManager worldManager, Client client, String name) {
    EventRecorder recorder = null;
    Client recorderClient = worldManager.getClientByName(name);
    if (recorderClient == null) {
      recorder = new EventRecorder(worldManager, client, name);
      // TODO make these command parameters
      recorder.setRecordClient(true);
      recorder.setRecordScene(false);
      recorder.setLoop(true);
      recorder = worldManager.save(recorder);
      log.debug("Created new recorder " + recorder + " for " + client);
    } else if (recorderClient instanceof EventRecorder) {
      recorder = (EventRecorder) recorderClient;
      log.debug("Found recorder " + recorder);
    }
    return recorder;
  }

}
