package org.vrspace.server.config;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.regex.Pattern;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.vrspace.server.core.ClassUtil;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.Private;

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

  @Bean
  public ObjectMapper objectMapper() {
    ObjectMapper ret = objectMapperBuilder().build();
    // process and add all subclasses of VRObject
    ClassUtil.findSubclasses(VRObject.class).forEach((c) -> ret.registerSubtypes(c));

    // by default, nothing annotated as Private will be serialized
    ret.setAnnotationIntrospector(new JacksonAnnotationIntrospector() {
      private static final long serialVersionUID = 1L;

      @Override
      public boolean hasIgnoreMarker(final AnnotatedMember m) {
        return super.hasIgnoreMarker(m) || m.hasAnnotation(Private.class);
      }
    });

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
    // this disables custom events
    // builder.featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
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