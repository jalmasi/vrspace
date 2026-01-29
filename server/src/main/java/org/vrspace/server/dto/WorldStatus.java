package org.vrspace.server.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Current world statistics, client/user count.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorldStatus {
  private String worldName;
  private int activeUsers;
  private int totalUsers;
  private int activeClients;
  private int totalClients;
}
