package org.vrspace.server.config;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Path;

import org.neo4j.configuration.connectors.BoltConnector;
import org.neo4j.configuration.connectors.HttpConnector;
import org.neo4j.dbms.api.DatabaseManagementService;
import org.neo4j.dbms.api.DatabaseManagementServiceBuilder;
import org.neo4j.graphdb.GraphDatabaseService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

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
  @Value("${spring.neo4j.uri:bolt://localhost}")
  private String neoUri;
  GraphDatabaseService graphDb;

  @Bean
  public GraphDatabaseService config() throws URISyntaxException, IOException {
    String path = dbPath;
    log.info("Configured database uri: " + path);
    path = path.replace('\\', '/');
    URI uri = new URI(path);
    File file = new File(uri.getSchemeSpecificPart()).getCanonicalFile().getAbsoluteFile();
    log.info("Absolute database path: " + file);
    neoStart(file.toPath());
    return graphDb;
  }

  public void neoStart(Path dbDir) {
    log.info("Starting database on " + neoUri);
    DatabaseManagementService managementService = new DatabaseManagementServiceBuilder(dbDir)
        .setConfig(BoltConnector.enabled, neoUri.startsWith("bolt:"))
        .setConfig(HttpConnector.enabled, neoUri.startsWith("http:")).build();
    graphDb = managementService.database("neo4j");
    registerShutdownHook(managementService);
  }

  private static void registerShutdownHook(final DatabaseManagementService managementService) {
    // Registers a shutdown hook for the Neo4j instance so that it
    // shuts down nicely when the VM exits (even if you "Ctrl-C" the
    // running application).
    Runtime.getRuntime().addShutdownHook(new Thread() {
      @Override
      public void run() {
        managementService.shutdown();
      }
    });
  }

}
