package org.vrspace.server.api;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@ControllerAdvice(basePackages = "org.vrspace")
public class ApiExceptionResolver extends ResponseEntityExceptionHandler {

  @ExceptionHandler(value = { ApiException.class })
  protected ResponseEntity<Object> handleConflict(RuntimeException ex, WebRequest request) {
    // return plain text
    // String responseBody = ex.getMessage();
    // return json string:
    ErrorMessage responseBody = new ErrorMessage(ex.getMessage());
    return handleExceptionInternal(ex, responseBody, new HttpHeaders(), HttpStatus.PRECONDITION_REQUIRED, request);
  }

  @ExceptionHandler(value = { SecurityException.class })
  protected ResponseEntity<Object> handleSecurity(SecurityException ex, WebRequest request) {
    // return plain text
    // String responseBody = ex.getMessage();
    // return json string:
    ErrorMessage responseBody = new ErrorMessage(ex.getMessage());
    return handleExceptionInternal(ex, responseBody, new HttpHeaders(), HttpStatus.FORBIDDEN, request);
  }

  @Override
  protected ResponseEntity<Object> handleNoHandlerFoundException(NoHandlerFoundException ex, HttpHeaders headers,
      HttpStatusCode status, WebRequest request) {
    log.warn("No handler found: " + status + " " + request + " - " + ex);
    return handleExceptionInternal(ex, null, headers, status, request);
  }

  @Override
  protected ResponseEntity<Object> handleNoResourceFoundException(NoResourceFoundException ex, HttpHeaders headers,
      HttpStatusCode status, WebRequest request) {
    log.warn("No resource found: " + status + " " + request + " - " + ex);

    return handleExceptionInternal(ex, null, headers, status, request);
  }

  @Data
  @AllArgsConstructor
  public class ErrorMessage {
    private String message;
  }
}