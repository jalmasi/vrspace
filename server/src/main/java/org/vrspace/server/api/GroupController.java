package org.vrspace.server.api;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.obj.Client;

import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping(GroupController.PATH)
public class GroupController extends ClientControllerBase {
  public static final String PATH = API_ROOT + "/groups";

  public void list(HttpSession session) {
  }

  protected Client getAuthorisedClient(HttpSession session) {
    if (!isAuthenticated(session)) {
      throw new SecurityException("Anonymous user");
    }
    Client client = findClient(session);
    if (client.isTemporary()) {
      throw new SecurityException("Temporary user");
    }
    return client;
  }
}
