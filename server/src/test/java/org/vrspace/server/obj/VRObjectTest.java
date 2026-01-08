package org.vrspace.server.obj;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

public class VRObjectTest {

  // due to the fact that equals and hash code are generated, they can be messed
  // up really easy
  @Test
  public void testEquals() {
    VRObject o1 = new VRObject("1");
    VRObject o2 = new VRObject("1");
    VRObject o3 = new VRObject("3");
    VRObject t1 = new VRObject("101", o1);
    VRObject t2 = new VRObject("101", o2);
    VRObject t3 = new VRObject("103", o1);

    assertEquals(o1, o2);
    assertEquals(o2, o1);
    assertFalse(o1.equals(o3));
    assertFalse(o2.equals(o3));
    assertFalse(o3.equals(o1));
    assertFalse(o3.equals(o2));

    assertEquals(t1, t2);
    assertEquals(t2, t1);
    assertFalse(t1.equals(t3));
    assertFalse(t3.equals(t1));
    assertFalse(o1.equals(t1));
    assertFalse(t1.equals(o1));

    assertEquals(o1, t1.getChildren().get(0));

    Client c1 = new Client("1", "test");
    assertFalse(c1.equals(o1));
  }

  @Test
  public void testChildren() throws Exception {
    assertThrows(IllegalArgumentException.class, () -> new VRObject("1", new VRObject("1")));
  }
}
