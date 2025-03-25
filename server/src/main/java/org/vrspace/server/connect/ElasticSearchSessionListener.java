package org.vrspace.server.connect;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.apache.commons.lang3.exception.ExceptionUtils;
import org.apache.http.Header;
import org.apache.http.HttpHost;
import org.apache.http.message.BasicHeader;
import org.elasticsearch.client.RestClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.vrspace.server.core.CustomTypeIdResolver;
import org.vrspace.server.core.SessionListener;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Command;
import org.vrspace.server.dto.Enter;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Ownership;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.obj.World;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonTypeIdResolver;

import co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._helpers.bulk.BulkIngester;
import co.elastic.clients.elasticsearch.core.IndexRequest;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * ElasticSearch session listener forwards all events to an ES node,
 * asynchronously.
 * 
 * https://www.elastic.co/guide/en/elasticsearch/client/java-api-client/current/index.html
 * 
 * @author joe
 *
 */
@Component
@Slf4j
@ConditionalOnProperty("org.vrspace.server.session-listener.es.url")
public class ElasticSearchSessionListener implements SessionListener {
  /** URL of the elasticsearch server */
  @Value("${org.vrspace.server.session-listener.es.url}")
  private String url;
  /** API key, usually generated in kibana */
  @Value("${org.vrspace.server.session-listener.es.key}")
  private String apiKey;
  /** Index to write to */
  @Value("${org.vrspace.server.session-listener.es.index}")
  private String index;
  @Autowired
  @Qualifier("objectMapper")
  ObjectMapper objectMapper;

  private BulkIngester<?> ingester;

  @PostConstruct
  public void setup() {
    log.info("Session listener configured for " + url);

    // Create the low-level client
    RestClient restClient = RestClient.builder(HttpHost.create(url))
        .setDefaultHeaders(new Header[] { new BasicHeader("Authorization", "ApiKey " + apiKey) }).build();

    // Create the transport with a Jackson mapper
    ElasticsearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper(objectMapper));

    ElasticsearchClient esClient = new ElasticsearchClient(transport);

    ESLogEntry entry = new ESLogEntry();
    entry.timestamp = LocalDateTime.now(ZoneId.of("UTC"));
    entry.duration = 0;
    Client client = new Client(1L);
    VRObject object = new VRObject(1L);
    entry.source = new ID(object);
    entry.client = new ID(client);
    entry.world = new World();
    entry.world.setName("Test world");
    entry.world.setDefaultWorld(false);
    entry.ownership = new Ownership(client, object);
    Enter enter = new Enter();
    enter.setWorld(entry.world.getName());
    entry.command = enter;
    entry.connect = true;
    entry.error = new ESErrorMessage("VRSpace session connector starting up", new RuntimeException("Test exception"));
    entry.changes = new HashMap<>();
    entry.changes.put("url", "https://www.vrspace.org");

    // using asynchronous non-blocking client - we don't want to slow down startup
    try (ElasticsearchAsyncClient asyncClient = new ElasticsearchAsyncClient(transport)) {
      asyncClient.index(IndexRequest.of(i -> i.index(index).document(entry))).whenComplete((response, exception) -> {
        if (exception != null) {
          log.error("Indexing error: ", exception);
        }
      });
    } catch (IOException e) {
      log.error("Error closing ES async client", e);
    }

    ingester = BulkIngester.of(b -> b.client(esClient).flushInterval(1, TimeUnit.SECONDS));
  }

  @PreDestroy
  public void destroy() {
    log.info("Session listener disconnecting from " + url);
    ingester.close();
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
    ingester.flush();
  }

  private void send(ESLogEntry entry) {
    // asyncClient.index(IndexRequest.of(i -> i.index(index).withJson(new
    // StringReader(request.getPayload()))))
    /*
    asyncClient.index(IndexRequest.of(i -> i.index(index).document(entry))).whenComplete((response, exception) -> {
      if (exception != null) {
        log.error("Indexing error: ", exception);
      }
    });
    */
    ingester.add(op -> op.index(i -> i.index(index).document(entry)));
  }

  @Data
  @JsonInclude(Include.NON_EMPTY)
  @ToString(callSuper = true)
  public class ESErrorMessage {
    private String message;
    private String stackTrace;

    public ESErrorMessage(String message, Throwable error) {
      this.message = message;
      if (error != null) {
        this.stackTrace = ExceptionUtils.getStackTrace(error);
      }
    }
  }

  @Data
  @NoArgsConstructor
  @JsonInclude(Include.NON_EMPTY)
  @ToString(callSuper = true)
  public class ESLogEntry {
    private Map<String, Object> changes;
    private LocalDateTime timestamp;
    private long duration;
    private ID source;
    private ID client;
    private World world;
    private Ownership ownership;
    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
    @JsonTypeIdResolver(CustomTypeIdResolver.class)
    private Command command;
    private Boolean connect;
    private ESErrorMessage error;

    public ESLogEntry(ClientRequest request) {
      this((VREvent) request);
      this.command = request.getCommand();
    }

    public ESLogEntry(VREvent event) {
      this.changes = event.getChanges();
      this.timestamp = event.getTimestamp();
      this.duration = Duration.between(this.timestamp, LocalDateTime.now(ZoneId.of("UTC"))).toMillis();
      if (event.getSource() != null) {
        this.source = event.getSource().getObjectId();
      }
      if (event.getClient() != null) {
        this.client = event.getClient().getObjectId();
        this.world = event.getClient().getWorld();
      } else if (event.getSource() != null && event.getSource() instanceof Client) {
        this.world = ((Client) event.getSource()).getWorld();
      }
      this.ownership = event.getOwnership();
    }

    public ESLogEntry(Client client, Boolean connect) {
      this.client = client.getObjectId();
      this.world = client.getWorld();
      this.timestamp = LocalDateTime.now(ZoneId.of("UTC"));
      this.connect = connect;
    }

    public ESLogEntry(Client client, String message, Throwable error) {
      this.client = client.getObjectId();
      this.world = client.getWorld();
      this.timestamp = LocalDateTime.now(ZoneId.of("UTC"));
      this.error = new ESErrorMessage(message, error);
    }
  }
}
