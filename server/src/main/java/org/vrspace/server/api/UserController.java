package org.vrspace.server.api;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.Client;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping("/user")
public class UserController {
  @Autowired
  VRObjectRepository db;

  @GetMapping("/available")
  public boolean checkName(String name) {
    Client client = db.getClientByName(name);
    log.debug("Client name " + name + " available: " + (client == null));
    return client == null;
  }
}
