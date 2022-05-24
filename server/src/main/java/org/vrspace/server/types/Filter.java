package org.vrspace.server.types;

import java.util.function.Function;

import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

@FunctionalInterface
public interface Filter extends Function<VRObject, Boolean> {

  static Filter isActive() {
    return o -> o.isActive();
  }

  static Filter removeOfflineClients() {
    return o -> !(o instanceof Client) || ((Client) o).isActive();
  }
}
