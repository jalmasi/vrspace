package org.vrspace.server.api;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@ControllerAdvice
public class ApiExceptionResolver extends ResponseEntityExceptionHandler {

  @ExceptionHandler(value = { ApiException.class })
  protected ResponseEntity<Object> handleConflict(RuntimeException ex, WebRequest request) {
    // CHECKME: return json string?
    String responseBody = ex.getMessage();
    return handleExceptionInternal(ex, responseBody, new HttpHeaders(), HttpStatus.PRECONDITION_REQUIRED, request);
  }

}