package org.vrspace.server.connect;

import java.io.StringReader;

import org.apache.http.Header;
import org.apache.http.HttpHost;
import org.apache.http.message.BasicHeader;
import org.elasticsearch.client.RestClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.vrspace.server.core.SessionListener;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.obj.Client;

import co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.IndexRequest;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
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
  @Value("${org.vrspace.server.session-listener.es.index}")
  private String index;

  private ElasticsearchAsyncClient asyncClient;
  ElasticsearchClient esClient;

  @PostConstruct
  public void setup() {
    log.info("Session listener configured for " + url);

    // Create the low-level client
    RestClient restClient = RestClient.builder(HttpHost.create(url))
        .setDefaultHeaders(new Header[] { new BasicHeader("Authorization", "ApiKey " + apiKey) }).build();

    // Create the transport with a Jackson mapper
    ElasticsearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());

    esClient = new ElasticsearchClient(transport);
    // Asynchronous non-blocking client
    asyncClient = new ElasticsearchAsyncClient(transport);
  }

  @Override
  public void success(ClientRequest request) {
    asyncClient.index(IndexRequest.of(i -> i.index(index).withJson(new StringReader(request.getPayload()))))
        .whenComplete((response, exception) -> {
          if (exception != null) {
            log.error("Indexing error: " + exception);
          }
        });
    /*
    try {
      IndexResponse response = esClient
          .index(IndexRequest.of(i -> i.index(index).withJson(new StringReader(request.getPayload()))));
    } catch (Exception exception) {
      log.error("Indexing error", exception);
    }
    */
  }

  @Override
  public void failure(WebSocketSession session, TextMessage message, Throwable error) {
  }

  @Override
  public void login(Client client) {
  }

  @Override
  public void logout(Client client) {
  }

}
