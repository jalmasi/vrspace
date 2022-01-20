package org.vrspace.server.dto;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.core.Scene;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.core.WriteBack;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@ExtendWith(MockitoExtension.class)
public class CommandTest {

  @Mock
  private ConcurrentWebSocketSessionDecorator session;

  @Mock
  private VRObjectRepository repo;

  @InjectMocks
  private WorldManager world;

  @Mock
  private Scene scene;

  @Mock
  private WriteBack writeBack;

  private ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

  private boolean isOwner = true;

  private Client client = new Client() {
    public boolean isOwner(VRObject o) {
      return isOwner;
    }
  };

  @BeforeEach
  public void setUp() throws Exception {
    client.setMapper(new ObjectMapper());
    client.setScene(scene);
    client.setSession(session);
    client.setWriteBack(writeBack);
  }

  @Test
  public void testAdd() throws Exception {
    when(repo.save(any(VRObject.class))).thenReturn(new VRObject(1L));

    Add add = new Add(new VRObject(1, 2, 3), new VRObject(3, 2, 1));
    ClientRequest request = new ClientRequest(client, add);
    println(request);
    world.dispatch(request);

    verify(repo, times(1)).save(any(Client.class));
    verify(repo, times(3)).save(any(VRObject.class));
    verify(scene, times(1)).publishAll(any());
  }

  @Test
  public void testRemoveFail() throws Exception {
    when(scene.get(any(ID.class))).thenReturn(new VRObject(1L));
    isOwner = false;
    Remove remove = new Remove(new VRObject(2L)).removeObject(new VRObject(1L));
    ClientRequest request = new ClientRequest(client, remove);
    assertThrows(SecurityException.class, () -> world.dispatch(request));
  }

  @Test
  public void testRemove() throws Exception {
    when(scene.get(any(ID.class))).thenReturn(new VRObject(1L));

    Remove remove = new Remove(new VRObject(2L)).removeObject(new VRObject(1L));
    ClientRequest request = new ClientRequest(client, remove);
    world.dispatch(request);

    verify(repo, times(2)).save(any(Client.class));
    verify(writeBack, times(2)).delete(any(VRObject.class));
    verify(scene, times(1)).unpublish(any());
  }

  @Test
  public void testRefresh() throws Exception {
    Refresh refresh = new Refresh();
    ClientRequest request = new ClientRequest(client, refresh);
    world.dispatch(request);

    verify(scene, times(1)).setDirty();
    verify(scene, times(1)).update();

    refresh.setClear(true);

    world.dispatch(request);

    verify(scene, times(1)).removeAll();
    verify(scene, times(2)).update();
  }

  private void println(Object obj) throws JsonProcessingException {
    System.err.println(mapper.writeValueAsString(obj));
  }
}
