package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.GroupMember;
import org.vrspace.server.obj.UserGroup;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(classes = JacksonConfig.class)
@ExtendWith(MockitoExtension.class)
public class GroupManagerTest {
  @Autowired
  private ObjectMapper objectMapper;

  @Mock
  private VRObjectRepository repo;
  @Mock
  private GroupRepository groupRepo;
  @Mock
  private WorldManager worldManager;

  @InjectMocks
  private GroupManager gm;

  // too complicated to set up in integration test
  @Test
  public void testWrite() {
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
    g1.setId("10");
    List<Client> g1members = List.of(c1, c2, c3);

    when(groupRepo.listGroupClients(g1.getId())).thenReturn(g1members);
    when(worldManager.getCachedClient(any(Client.class)))
        .thenAnswer(invocation -> clientCache.get(((Client) invocation.getArguments()[0]).getObjectId()));
    when(groupRepo.findGroupMember(eq(g1.getId()), anyString())).thenReturn(Optional.of(new GroupMember()));
    when(groupRepo.findGroupMember(eq(g1.getId()), eq("4"))).thenReturn(Optional.empty());
    when(repo.save(any())).thenAnswer(invocation -> invocation.getArguments()[0]);

    gm.write(c1, g1, "Hello world");

    verify(c1, times(1)).sendMessage(any());
    verify(c2, times(1)).sendMessage(any());
    verify(c3, times(0)).sendMessage(any());

    assertThrows(SecurityException.class, () -> gm.write(new Client(4L), g1, "Hello world"));

  }
}
