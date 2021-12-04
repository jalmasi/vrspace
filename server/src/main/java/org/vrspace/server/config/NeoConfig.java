package org.vrspace.server.config;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Path;

import javax.annotation.PreDestroy;

import org.neo4j.configuration.GraphDatabaseSettings;
import org.neo4j.configuration.connectors.BoltConnector;
import org.neo4j.configuration.connectors.HttpConnector;
import org.neo4j.configuration.helpers.SocketAddress;
import org.neo4j.dbms.api.DatabaseManagementService;
import org.neo4j.dbms.api.DatabaseManagementServiceBuilder;
import org.neo4j.graphdb.GraphDatabaseService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.FileSystemUtils;

import lombok.extern.slf4j.Slf4j;

/**
 * Starts embedded Neo4J with database in directory specified in org.vrspace.db
 * property - only if the property is set.
 * 
 * @author joe
 *
 */
@Slf4j
@Configuration
@ConditionalOnProperty("org.vrspace.db")
public class NeoConfig {
  @Value("${org.vrspace.db}")
  private String dbPath;
  @Value("${org.vrspace.db.cleanup:false}")
  private boolean cleanup;
  @Value("${spring.neo4j.uri:bolt://localhost}")
  private String neoUri;

  private GraphDatabaseService graphDb;
  private DatabaseManagementService managementService;
  private File dbDir;

  @Bean
  public GraphDatabaseService config() throws URISyntaxException, IOException {
    String path = dbPath;
    log.info("Configured database uri: " + path);
    path = path.replace('\\', '/');
    URI uri = new URI(path);
    dbDir = new File(uri.getSchemeSpecificPart()).getCanonicalFile().getAbsoluteFile();
    log.info("Absolute database path: " + dbDir);
    neoStart(dbDir.toPath());
    return graphDb;
  }

  public void neoStart(Path dbDir) {
    int port = BoltConnector.DEFAULT_PORT;
    int pos = neoUri.indexOf(":", neoUri.indexOf("://") + 1);
    if (pos > 0) {
      String sPort = neoUri.substring(pos + 1);
      try {
        port = Integer.valueOf(sPort);
      } catch (Exception e) {
        log.error("Can't parse database port from " + neoUri + " - " + e);
      }
    }
    log.info("Starting database on " + neoUri);
    managementService = new DatabaseManagementServiceBuilder(dbDir).setConfig(GraphDatabaseSettings.allow_upgrade, true)
        .setConfig(BoltConnector.enabled, neoUri.startsWith("bolt:"))
        .setConfig(BoltConnector.listen_address, new SocketAddress("localhost", port))
        .setConfig(HttpConnector.enabled, neoUri.startsWith("http:")).build();
    graphDb = managementService.database("neo4j");

    // and now indexes
    graphDb.executeTransactionally("CREATE CONSTRAINT worldName IF NOT EXISTS ON (w:World) ASSERT w.name IS UNIQUE");
    graphDb.executeTransactionally("CREATE CONSTRAINT clientName IF NOT EXISTS ON (c:Client) ASSERT c.name IS UNIQUE");
    graphDb.executeTransactionally("CREATE INDEX clientWorld IF NOT EXISTS FOR (c:Client) ON (c.world)");
    graphDb.executeTransactionally("CREATE INDEX pointCoord IF NOT EXISTS FOR (p:Point) ON (p.x, p.y, p.z)");

  }

  @PreDestroy
  public void stop() {
    log.info("Database shutting down...");
    managementService.shutdown();
    log.info("Database shutting down complete");
    if (cleanup && dbDir != null) {
      log.info("Deleting database directory " + dbDir);
      FileSystemUtils.deleteRecursively(dbDir);
    }
  }

}
