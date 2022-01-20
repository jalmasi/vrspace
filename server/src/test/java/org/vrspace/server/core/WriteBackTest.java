package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.vrspace.server.obj.VRObject;

@ExtendWith(MockitoExtension.class)
public class WriteBackTest {
  @Mock
  private VRObjectRepository db;

  @InjectMocks
  private WriteBack writeBack;

  @Test
  public void basicTest() {
    assertEquals(0, writeBack.writeRequests());
    assertEquals(0, writeBack.writes());

    VRObject o = new VRObject(1L);
    writeBack.write(o);

    // first write always flushes
    assertEquals(1, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());
    assertEquals(0, writeBack.size());

    writeBack.flush();
    // flush with no pending writes does nothing
    assertEquals(1, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());
    assertEquals(0, writeBack.size());

    writeBack.write(o);
    // write without flush does nothing (depends on timeout though)
    assertEquals(2, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());
    assertEquals(1, writeBack.size());

    writeBack.delete(o);
    // delete without flush does nothing (does to the db though)
    assertEquals(2, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());
    assertEquals(0, writeBack.size());

    writeBack.flush();
    // deleted ones should not be written
    assertEquals(2, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());
    assertEquals(0, writeBack.size());

    writeBack.write(o);
    writeBack.write(o);
    // write requests are accounted for
    assertEquals(4, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());
    assertEquals(1, writeBack.size());

    writeBack.flush();
    // flush is flushed
    assertEquals(4, writeBack.writeRequests());
    assertEquals(2, writeBack.writes());
    assertEquals(0, writeBack.size());
  }

  @Test
  public void testDisabled() {
    assertEquals(0, writeBack.writeRequests());
    assertEquals(0, writeBack.writes());

    writeBack.setActive(false);

    VRObject o = new VRObject(1L);
    writeBack.write(o);
    // write does nothing
    assertEquals(0, writeBack.writeRequests());
    assertEquals(0, writeBack.writes());

    writeBack.flush();
    // flush does nothing
    assertEquals(0, writeBack.writeRequests());
    assertEquals(0, writeBack.writes());
  }

  @Test
  public void testDelay() throws Exception {
    assertEquals(0, writeBack.writeRequests());
    assertEquals(0, writeBack.writes());

    long delay = 100L;
    writeBack.setDelay(delay);

    VRObject o = new VRObject(1L);
    writeBack.write(o);

    // first write always flushes
    assertEquals(1, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());

    writeBack.write(o);
    // second one should not...
    assertEquals(2, writeBack.writeRequests());
    assertEquals(1, writeBack.writes());

    Thread.sleep(delay + 1);
    writeBack.write(o);
    // ... until after delay
    assertEquals(3, writeBack.writeRequests());
    assertEquals(2, writeBack.writes());
  }
}
