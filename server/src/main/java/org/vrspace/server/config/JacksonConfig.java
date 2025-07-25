package org.vrspace.server.config;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.vrspace.server.core.ClassUtil;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.Private;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.deser.std.StdScalarDeserializer;
import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
import com.fasterxml.jackson.databind.introspect.JacksonAnnotationIntrospector;
import com.fasterxml.jackson.databind.ser.std.StdScalarSerializer;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

/**
 * Jackson JSON parser configuration. Configures date format and string
 * de/serializers to prevent XSS.
 * 
 * @author joe
 *
 */
@Configuration
public class JacksonConfig {
  private Pattern htmlTag = Pattern.compile("<.+?>");

  /**
   * ObjectMapper for serialization over web sockets. By default, fields that are
   * annotated as @Private will not be serialized.
   */
  @Bean("objectMapper")
  public ObjectMapper objectMapper() {
    ObjectMapper ret = objectMapperBuilder().build();
    // process and add all subclasses of VRObject
    ClassUtil.findSubclasses(VRObject.class).forEach((c) -> ret.registerSubtypes(c));

    ret.setAnnotationIntrospector(new JacksonAnnotationIntrospector() {
      private static final long serialVersionUID = 1L;

      @Override
      public boolean hasIgnoreMarker(final AnnotatedMember m) {
        return super.hasIgnoreMarker(m) || m.hasAnnotation(Private.class);
      }
    });

    return ret;
  }

  /**
   * Private mapper is same as objectMapper, but also serializes @Private fields,
   * so that a client can access own private properties over web sockets.
   */
  @Bean("privateMapper")
  public ObjectMapper privateMapper() {
    ObjectMapper ret = objectMapperBuilder().build();
    // process and add all subclasses of VRObject
    ClassUtil.findSubclasses(VRObject.class).forEach((c) -> ret.registerSubtypes(c));

    return ret;
  }

  /**
   * Primary mapper is the same as objectMapper, but ignores @JsonTypeInfo
   * annotation of VRObject. Annotated as Primary to make REST controllers used it
   * for serialization.
   */
  @Primary
  @Bean("restMapper")
  public ObjectMapper restMapper() {
    ObjectMapper ret = objectMapperBuilder().build();
    // trick taken from
    // https://stackoverflow.com/questions/54708772/jackson-suppress-jsontypeinfo-at-serialisation-time
    @JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
    class NoTypes {
    }
    ret.addMixIn(VRObject.class, NoTypes.class);
    // process and add all subclasses of VRObject
    ClassUtil.findSubclasses(VRObject.class).forEach((c) -> ret.registerSubtypes(c));

    ret.setAnnotationIntrospector(new JacksonAnnotationIntrospector() {
      private static final long serialVersionUID = 1L;

      @Override
      public boolean hasIgnoreMarker(final AnnotatedMember m) {
        return super.hasIgnoreMarker(m) || m.hasAnnotation(Private.class);
      }
    });

    return ret;
  }

  /**
   * Primary mapper is the same as privateMapper, but ignores @JsonTypeInfo
   * annotation of VRObject. Usage in REST controllers only manual: return String
   * ResponseEntity, but specify return type with OpenApi @Schema annotation.
   */
  @Bean("restPrivateMapper")
  public ObjectMapper restPrivateMapper() {
    ObjectMapper ret = objectMapperBuilder().build();
    @JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
    class NoTypes {
    }
    ret.addMixIn(VRObject.class, NoTypes.class);
    // process and add all subclasses of VRObject
    ClassUtil.findSubclasses(VRObject.class).forEach((c) -> ret.registerSubtypes(c));

    return ret;
  }

  @Bean
  public Jackson2ObjectMapperBuilder objectMapperBuilder() {
    Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder();

    // mandatory to deserialize object identifiers:
    builder.featuresToEnable(DeserializationFeature.USE_LONG_FOR_INTS);

    // sanitize json:
    builder.deserializerByType(String.class, new SanitizeStringDeserializer());
    builder.serializerByType(String.class, new SanitizeStringSerializer());

    // JSON date/time proper format:
    builder.featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    // this disables custom events, useful for debugging only
    // builder.featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    // may be useful for debugging
    // builder.featuresToEnable(DeserializationFeature.FAIL_ON_INVALID_SUBTYPE);
    JavaTimeModule module = new JavaTimeModule();
    module.addDeserializer(LocalDate.class, new LocalDateDeserializer(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
    module.addSerializer(LocalDate.class, new LocalDateSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
    module.addDeserializer(LocalDateTime.class,
        new LocalDateTimeDeserializer(DateTimeFormatter.ofPattern("yyyy-MM-dd['T'HH:mm[:ss[.SSSSSSSSS]]]")));
    module.addSerializer(LocalDateTime.class,
        new LocalDateTimeSerializer(DateTimeFormatter.ofPattern("yyyy-MM-dd['T'HH:mm[:ss[.SSSSSSSSS]]]")));
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

}