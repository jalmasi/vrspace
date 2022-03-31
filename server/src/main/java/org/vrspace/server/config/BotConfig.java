package org.vrspace.server.config;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.Rotation;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.AccessLevel;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

@Configuration
@ConfigurationProperties("org.vrspace.server")
@Data
@NoArgsConstructor
@Slf4j
public class BotConfig {
  private Map<String, BotProperties> bot = new HashMap<>();

  @Data
  @NoArgsConstructor
  public static class BotProperties {
    private String type;
    private String name;
    private String url;
    private String world;
    private String mesh;
    private Map<String, String> parameterMap;
    private List<Double> position;
    private List<Double> rotation;
    private List<Double> scale;
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private String params;

    @SuppressWarnings("unchecked")
    public void setParams(String params) {
      ObjectMapper mapper = new ObjectMapper();
      try {
        this.params = params;
        parameterMap = mapper.readValue(params, Map.class);
      } catch (Exception e) {
        log.error("Can't read bot parameters " + params, e);
      }
    }

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
