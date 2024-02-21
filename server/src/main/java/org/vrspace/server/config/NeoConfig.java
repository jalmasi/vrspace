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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.FileSystemUtils;

import lombok.extern.slf4j.Slf4j;

/**
 * Starts embedded Neo4J with database in directory specified in org.vrspace.db
 * property - only if the property is set. Otherwise, database connection is
 * controlled by the framework, and spring.neo4j.uri,
 * spring.neo4j.authentication.username and spring.neo4j.authentication.password
 * properties.
 * 
 * @author joe
 *
 */
@Slf4j
@Configuration
//@ConditionalOnProperty("org.vrspace.db")
public class NeoConfig {
  /**
   * Should the server use embedded database, property org.vrspace.db.embedded,
   * default true
   */
  @Value("${org.vrspace.db.embedded:#{true}}")
  private boolean embedded;
  /**
   * Directory containing embedded database, property org.vrspace.db, default
   * file:./vrspace.db (subdirectory of the server directory)
   */
  @Value("${org.vrspace.db:file:./vrspace.db}")
  private String dbPath;
  /**
   * Recursive removal database directory on startup and shutdown, used in tests.
   * Property org.vrspace.db.cleanup, default false
   */
  @Value("${org.vrspace.db.cleanup:false}")
  private boolean cleanup;
  /**
   * Neo4j database URI, defaults to embedded/local database, bolt://localhost.
   * Property spring.neo4j.uri
   */
  @Value("${spring.neo4j.uri:bolt://localhost}")
  private String neoUri;

  private GraphDatabaseService graphDb;
  private DatabaseManagementService managementService;
  private File dbDir;

  @Bean("database")
  GraphDatabaseService config() throws URISyntaxException, IOException {
    String path = dbPath;
    if (embedded) {
      log.info("Configured database uri: " + path);
      path = path.replace('\\', '/');
      URI uri = new URI(path);
      dbDir = new File(uri.getSchemeSpecificPart()).getCanonicalFile().getAbsoluteFile();
      log.info("Absolute database path: " + dbDir);
      neoStart(dbDir.toPath());
      return graphDb;
    }
    log.info("Using external database uri: " + neoUri);
    return null;
  }

  private void neoStart(Path dbDir) {
    cleanup();
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
    graphDb.executeTransactionally("CREATE INDEX clientWorld IF NOT EXISTS FOR (c:Client) ON (c.worldId)");
    graphDb.executeTransactionally("CREATE INDEX pointCoord IF NOT EXISTS FOR (p:Point) ON (p.x, p.y, p.z)");
    // only single property uniqueness constraints are supported
    // "CREATE CONSTRAINT ownership IF NOT EXISTS on (o:Ownership) ASSERT
    // (o.owner,o.owned) IS UNIQUE");
    graphDb.executeTransactionally("CREATE INDEX ownership IF NOT EXISTS FOR (o:Ownership) ON (o.owner,o.owned)");
  }

  @PreDestroy
  public void stop() {
    // null when using external database
    if (managementService != null) {
      log.info("Database shutting down...");
      managementService.shutdown();
      log.info("Database shutting down complete");
      cleanup();
    }
  }

  private void cleanup() {
    if (cleanup && dbDir != null) {
      log.info("Deleting database directory " + dbDir);
      FileSystemUtils.deleteRecursively(dbDir);
    }
  }

}
