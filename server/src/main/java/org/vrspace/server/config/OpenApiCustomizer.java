package org.vrspace.server.config;

import java.util.Optional;

import org.springdoc.core.customizers.GlobalOperationCustomizer;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;

import io.swagger.v3.oas.models.Operation;

/**
 * Disables uniqueness of auto-generated OpenApi operation id, by enforcing name
 * from either Operation annotation, or from method name. In the spec,
 * operationId must be unique, so SpringDoc by default generates operations like
 * list, list_2, list_3 etc, for every method of every controller that is named
 * list. Generated REST client than gets list2() etc method. This forces either
 * 1) server-wide unique REST controller method names or 2) use swagger
 * Operation annotation to designate generated client method name. Otherwise,
 * mvn generate-sources -P openapi fails to validate the spec.
 * 
 * https://github.com/springdoc/springdoc-openapi/issues/2646
 * 
 * @author joe
 *
 */
@Component
public class OpenApiCustomizer implements GlobalOperationCustomizer {
  @Override
  public Operation customize(Operation operation, HandlerMethod handlerMethod) {
    operation.setOperationId(
        Optional.ofNullable(handlerMethod.getMethodAnnotation(io.swagger.v3.oas.annotations.Operation.class))
            .map(io.swagger.v3.oas.annotations.Operation::operationId).orElseGet(handlerMethod.getMethod()::getName));
    return operation;
  }
}
