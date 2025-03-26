package org.vrspace.server.api;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.UserData;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

/**
 * Adds custom data to the user. These are simple key-value pairs, strings only.
 * User has to be logged in and connected to use any of these methods, or else.
 * 
 * @author joe
 *
 */
@RestController
@RequestMapping(Data.PATH)
@Slf4j
public class Data extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/user-data";

  @Autowired
  VRObjectRepository db;

  /**
   * List all user data belonging to the client.
   */
  @GetMapping
  public List<UserData> listUserData(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Get user data, user: " + client);
    return db.listUserData(client.getId());
  }

  /**
   * Add or replace existing user data.
   * 
   * @param data the key-value pair.
   */
  @PostMapping
  public ResponseEntity<Void> setUserData(@RequestBody UserData data, HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Post user data, user: " + client);
    UserData existing = db.get(db.findUserData(client.getId(), data.getKey()));
    if (existing == null) {
      existing = new UserData();
    }
    // CHECKME sanitize?
    existing.setKey(data.getKey());
    existing.setValue(data.getValue());
    db.save(existing);
    if (existing.getId() == null) {
      return new ResponseEntity<Void>(HttpStatusCode.valueOf(201));
    } else {
      return new ResponseEntity<Void>(HttpStatusCode.valueOf(200));
    }
  }

  /**
   * Delete all user data belonging to the client.
   */
  @DeleteMapping
  public void clearUserData(HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Clear user data, user: " + client);
    db.listUserData(client.getId()).forEach(data -> db.delete(data));
  }

  /**
   * Delete a value for the given key.
   */
  @DeleteMapping("/{key}")
  public void deleteUserData(@PathVariable String key, HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Delete user data, user: " + client + " key: " + key);
    UserData existing = db.get(db.findUserData(client.getId(), key));
    if (existing == null) {
      db.delete(existing);
    }
  }

  /**
   * Get user data for the key
   * 
   * @param key specifies which value to get
   */
  @GetMapping("/{key}")
  public ResponseEntity<UserData> getUserData(@PathVariable String key, HttpSession session) {
    Client client = getAuthorisedClient(session);
    log.debug("Delete user data, user: " + client + " key: " + key);
    UserData existing = db.get(db.findUserData(client.getId(), key));
    if (existing == null) {
      return new ResponseEntity<UserData>(existing, HttpStatusCode.valueOf(200));
    }
    return new ResponseEntity<UserData>(HttpStatusCode.valueOf(404));
  }

}
