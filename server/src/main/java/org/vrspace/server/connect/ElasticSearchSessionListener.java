package org.vrspace.server.connect;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.vrspace.server.core.SessionListener;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
@ConditionalOnProperty("org.vrspace.server.session-listener.es.url")
public class ElasticSearchSessionListener implements SessionListener {
  @Value("${org.vrspace.server.session-listener.es.url}")
  private String url;
  @Value("${org.vrspace.server.session-listener.es.key}")
  private String apiKey;

  @PostConstruct
  public void setup() {
    log.info("Session listener configured for " + url);
  }
}
