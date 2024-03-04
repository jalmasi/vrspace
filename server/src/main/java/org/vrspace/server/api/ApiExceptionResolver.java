package org.vrspace.server.api;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import lombok.AllArgsConstructor;
import lombok.Data;

@ControllerAdvice
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

  @Data
  @AllArgsConstructor
  public class ErrorMessage {
    private String message;
  }
}