package org.vrspace.server.dto;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@RunWith(SpringRunner.class)
public class CommandTest {

  @Mock
  private WebSocketSession session;

  @Mock
  private VRObjectRepository repo;

  @InjectMocks
  private WorldManager world;

  @Mock
  private Scene scene;

  private ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

  private boolean isOwner = true;

  private Client client = new Client() {
    public boolean isOwner(VRObject o) {
      return isOwner;
    }
  };

  @Before
  public void setUp() throws Exception {
    client.setMapper(new ObjectMapper());
    client.setScene(scene);
    client.setSession(session);
    when(repo.save(any(VRObject.class))).thenReturn(new VRObject(1L));
    doNothing().when(session).sendMessage(any(WebSocketMessage.class));
  }

  @Test
  public void testAdd() throws Exception {
    Add add = new Add(new VRObject(1, 2, 3), new VRObject(3, 2, 1));
    ClientRequest request = new ClientRequest(client, add);
    println(request);
    world.dispatch(request);

    verify(repo, times(1)).save(any(Client.class));
    verify(repo, times(3)).save(any(VRObject.class));
    verify(scene, times(1)).setDirty();
  }

  @Test(expected = SecurityException.class)
  public void testRemoveFail() throws Exception {
    isOwner = false;
    Remove remove = new Remove(new VRObject(2L)).removeObject(new VRObject(1L));
    ClientRequest request = new ClientRequest(client, remove);
    world.dispatch(request);
  }

  @Test
  public void testRemove() throws Exception {
    Remove remove = new Remove(new VRObject(2L)).removeObject(new VRObject(1L));
    ClientRequest request = new ClientRequest(client, remove);
    world.dispatch(request);

    verify(repo, times(2)).save(any(Client.class));
    verify(repo, times(2)).deleteById(any(Long.class));
    verify(scene, times(1)).setDirty();
  }

  private void println(Object obj) throws JsonProcessingException {
    System.err.println(mapper.writeValueAsString(obj));
  }
}
