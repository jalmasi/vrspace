package org.vrspace.server.config;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.Rotation;

import lombok.Data;
import lombok.NoArgsConstructor;

@Configuration
@ConfigurationProperties("org.vrspace.server")
@Data
@NoArgsConstructor
public class BotConfig {
  private Map<String, BotProperties> bot = new HashMap<>();

  @Data
  @NoArgsConstructor
  public static class BotProperties {
    private String type = "json";
    private String name;
    private String url;
    private String world;
    private List<Double> position;
    private List<Double> rotation;
    private List<Double> scale;

    public boolean hasPoint(List<Double> coord) {
      return coord != null && coord.size() >= 3;
    }

    public Point getPoint(List<Double> coord) {
      return new Point(coord.get(0), coord.get(1), coord.get(2));
    }

    public Rotation getRotation(List<Double> coord) {
      if (coord.size() > 3) {
        return new Rotation(coord.get(0), coord.get(1), coord.get(2), coord.get(3));
      }
      return new Rotation(coord.get(0), coord.get(1), coord.get(2), 0);
    }
  }

}
