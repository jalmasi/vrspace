package org.vrspace.server.connect;

import java.time.LocalDateTime;
import java.util.Map;

import org.apache.http.Header;
import org.apache.http.HttpHost;
import org.apache.http.message.BasicHeader;
import org.elasticsearch.client.RestClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.vrspace.server.core.CustomTypeIdResolver;
import org.vrspace.server.core.SessionListener;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.World;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonTypeIdResolver;

import co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.IndexRequest;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import jakarta.annotation.PostConstruct;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * ElasticSearch session listener forwards all events to an ES node,
 * asynchronously.
 */
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
  @Autowired
  ObjectMapper objectMapper;

  private ElasticsearchAsyncClient asyncClient;
  ElasticsearchClient esClient;

  @PostConstruct
  public void setup() {
    log.info("Session listener configured for " + url);

    // Create the low-level client
    RestClient restClient = RestClient.builder(HttpHost.create(url))
        .setDefaultHeaders(new Header[] { new BasicHeader("Authorization", "ApiKey " + apiKey) }).build();

    // Create the transport with a Jackson mapper
    ElasticsearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper(objectMapper));

    esClient = new ElasticsearchClient(transport);
    // Asynchronous non-blocking client
    asyncClient = new ElasticsearchAsyncClient(transport);
  }

  @Override
  public void success(ClientRequest request) {
    send(new ESLogEntry(request));
  }

  @Override
  public void event(VREvent event) {
    send(new ESLogEntry(event));
  }

  @Override
  public void failure(Client client, String message, Throwable error) {
    send(new ESLogEntry(client, message, error));
  }

  @Override
  public void login(Client client) {
    send(new ESLogEntry(client, true));
  }

  @Override
  public void logout(Client client) {
    send(new ESLogEntry(client, false));
  }

  private void send(ESLogEntry entry) {
    // asyncClient.index(IndexRequest.of(i -> i.index(index).withJson(new
    // StringReader(request.getPayload()))))
    asyncClient.index(IndexRequest.of(i -> i.index(index).document(entry))).whenComplete((response, exception) -> {
      if (exception != null) {
        log.error("Indexing error: ", exception);
      }
    });
  }

  @Data
  @NoArgsConstructor
  @JsonInclude(Include.NON_EMPTY)
  @ToString(callSuper = true)
  public class ESLogEntry {
    private Map<String, Object> changes;
    private LocalDateTime timestamp;
    private ID source;
    private ID client;
    private World world;
    private Ownership ownership;
    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
    @JsonTypeIdResolver(CustomTypeIdResolver.class)
    private Command command;
    private Boolean connect;
    private Throwable error;
    private String message;

    public ESLogEntry(ClientRequest request) {
      this((VREvent) request);
      this.command = request.getCommand();
    }

    public ESLogEntry(VREvent event) {
      this.changes = event.getChanges();
      this.timestamp = event.getTimestamp();
      if (event.getSource() != null) {
        this.source = event.getSource().getObjectId();
      }
      if (event.getClient() != null) {
        this.client = event.getClient().getObjectId();
        this.world = event.getClient().getWorld();
      }
      this.ownership = event.getOwnership();
    }

    public ESLogEntry(Client client, Boolean connect) {
      this.client = client.getObjectId();
      this.world = client.getWorld();
      this.connect = connect;
    }

    public ESLogEntry(Client client, String message, Throwable error) {
      this.client = client.getObjectId();
      this.world = client.getWorld();
      this.message = message;
      this.error = error;
    }
  }
}
