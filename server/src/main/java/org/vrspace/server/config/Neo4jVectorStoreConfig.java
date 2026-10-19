package org.vrspace.server.config;

import org.neo4j.driver.Driver;
import org.springframework.ai.embedding.BatchingStrategy;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.TokenCountBatchingStrategy;
import org.springframework.ai.vectorstore.neo4j.Neo4jVectorStore;
import org.springframework.ai.vectorstore.neo4j.autoconfigure.Neo4jVectorStoreProperties;
import org.springframework.ai.vectorstore.observation.VectorStoreObservationConvention;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.micrometer.observation.ObservationRegistry;

/**
 * Copy of spring boot Neo4jVectorStoreAutoConfiguration, that can be disabled. (we don't want vector store if we don't have
 * ollama)
 * 
 * @author joe
 *
 */
@Configuration
@ConditionalOnBean({ OllamaConfig.class, NeoConfig.class })
public class Neo4jVectorStoreConfig {

  @Bean
  @ConditionalOnMissingBean
  BatchingStrategy batchingStrategy() {
    return new TokenCountBatchingStrategy();
  }

  @Bean
  @ConditionalOnMissingBean
  Neo4jVectorStore vectorStore(
      Driver driver,
      EmbeddingModel embeddingModel,
      Neo4jVectorStoreProperties properties,
      ObjectProvider<ObservationRegistry> observationRegistry,
      ObjectProvider<VectorStoreObservationConvention> customObservationConvention,
      BatchingStrategy batchingStrategy) {

    return Neo4jVectorStore
        .builder(driver, embeddingModel)
        .initializeSchema(properties.isInitializeSchema())
        .observationRegistry(observationRegistry.getIfUnique(() -> ObservationRegistry.NOOP))
        .customObservationConvention(customObservationConvention.getIfAvailable(() -> null))
        .batchingStrategy(batchingStrategy)
        .databaseName(properties.getDatabaseName())
        .embeddingDimension(
            properties.getEmbeddingDimension() != null ? properties.getEmbeddingDimension() : embeddingModel.dimensions())
        .distanceType(properties.getDistanceType())
        .label(properties.getLabel())
        .embeddingProperty(properties.getEmbeddingProperty())
        .indexName(properties.getIndexName())
        .idProperty(properties.getIdProperty())
        .constraintName(properties.getConstraintName())
        .textProperty(properties.getTextProperty())
        .build();
  }

  @Bean
  @ConditionalOnMissingBean
  Neo4jVectorStoreProperties vectorStoreProperties() {
    return new Neo4jVectorStoreProperties();
  }

}
