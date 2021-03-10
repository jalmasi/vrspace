package org.vrspace.server;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

import org.neo4j.ogm.config.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.ser.std.StdScalarSerializer;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

import lombok.extern.slf4j.Slf4j;

/**
 * Main application and configuration of Neo4J (using embedded by default) and
 * Jackson (sanitize json strings).
 * 
 * @author joe
 *
 */
@SpringBootApplication
@Slf4j
public class ServerApplication {
  @Value("${spring.data.neo4j.uri:default}")
  private String neoUri;
  @Value("${spring.data.neo4j.auto-index:update}")
  private String neoAutoIndex;
  @Value("${spring.data.neo4j.username:N/A}")
  private String neoUser;
  @Value("${spring.data.neo4j.password:N/A}")
  private String neoPassword;

  private Pattern htmlTag = Pattern.compile("<.+?>");

  @Bean
  public Configuration neoConfig() throws URISyntaxException, IOException {
    String path = neoUri;
    Configuration.Builder builder = new Configuration.Builder();
    if (!"default".equals(path)) {
      log.info("Configured database uri: " + path);
      path = path.replace('\\', '/');
      URI uri = new URI(path);
      if ("file".equals(uri.getScheme())) {
        File file = new File(uri.getSchemeSpecificPart());
        path = "file:///" + file.getCanonicalFile().getAbsolutePath().replace('\\', '/');
        log.info("Absolute database path: " + path);
      }
      builder.uri(path);
    }
    builder.autoIndex(neoAutoIndex);
    if (!"N/A".equals(neoUser)) {
      builder.credentials(neoUser, neoPassword);
    }
    return builder.build();
  }

  @Bean
  public Jackson2ObjectMapperBuilder objectMapperBuilder() {
    Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder();

    // mandatory to deserialize object identifiers:
    builder.featuresToEnable(DeserializationFeature.USE_LONG_FOR_INTS);

    // sanitize json:
    builder.deserializerByType(String.class, new SanitizeStringDeserializer());
    builder.serializerByType(String.class, new SanitizeStringSerializer());

    // TODO JSON date/time proper format:
    builder.featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    JavaTimeModule module = new JavaTimeModule();
    module.addDeserializer(LocalDate.class, new LocalDateDeserializer(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
    module.addSerializer(LocalDate.class, new LocalDateSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
    module.addDeserializer(LocalDateTime.class,
        new LocalDateTimeDeserializer(DateTimeFormatter.ofPattern("yyyy-MM-dd['T'HH:mm[:ss[.SSS]]]")));
    module.addSerializer(LocalDateTime.class,
        new LocalDateTimeSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd['T'HH:mm[:ss[.SSS]]]")));
    builder.modules(module);

    return builder;
  }

  /**
   * Removes HTML tags from a JSON string
   */
  private String removeHtmlTags(String arg) {
    return htmlTag.matcher(arg).replaceAll("");
  }

  /**
   * Converts JSON string to Java string
   */
  public class SanitizeStringDeserializer extends StdScalarDeserializer<String> {
    private static final long serialVersionUID = 1L;

    protected SanitizeStringDeserializer() {
      super(String.class);
    }

    @Override
    public String deserialize(JsonParser p, DeserializationContext ctxt) throws IOException, JsonProcessingException {
      return removeHtmlTags(p.getText());
    }
  }

  /**
   * Converts Java string to JSON string
   */
  public class SanitizeStringSerializer extends StdScalarSerializer<String> {
    private static final long serialVersionUID = 1L;

    public SanitizeStringSerializer() {
      super(String.class);
    }

    @Override
    public void serialize(String value, JsonGenerator gen, SerializerProvider provider) throws IOException {
      String clean = removeHtmlTags(value);
      gen.writeString(clean);
    }
  }

  public static void main(String[] args) {
    SpringApplication.run(ServerApplication.class, args);
  }

}
