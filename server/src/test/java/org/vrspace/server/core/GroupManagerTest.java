package org.vrspace.server.core;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.UserGroup;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(classes = JacksonConfig.class)
@ExtendWith(MockitoExtension.class)
public class GroupManagerTest {
  @Autowired
  private ObjectMapper objectMapper;

  private VRObjectRepository repo = mock(VRObjectRepository.class);
  private WorldManager worldManager = mock(WorldManager.class);

  private GroupManager gm = new GroupManager(worldManager, repo);

  @Test
  public void testSomething() {
    Client c1 = spy(new Client(1L));
    Client c2 = spy(new Client(2L));
    Client c3 = spy(new Client(3L));
    c1.active();
    c2.active();
    c3.passive();
    c1.setName("client one");
    c2.setName("client two");
    c3.setName("client three");
    c1.setMapper(objectMapper);
    c2.setMapper(objectMapper);
    c3.setMapper(objectMapper);

    Map<ID, Client> clientCache = Map.of(c1.getObjectId(), c1, c2.getObjectId(), c2);
    UserGroup g1 = new UserGroup();
    g1.setId(10L);
    List<Client> g1members = List.of(c1, c2, c3);

    when(repo.listGroupClients(g1.getId())).thenReturn(g1members);
    when(worldManager.get(any(ID.class))).thenAnswer(invocation -> clientCache.get(invocation.getArguments()[0]));

    gm.write(c1, g1, "Hello world");

    verify(c1, times(1)).sendMessage(any());
    verify(c2, times(1)).sendMessage(any());
    verify(c3, times(0)).sendMessage(any());
  }
}
