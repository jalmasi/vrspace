package org.vrspace.server.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(value = HttpStatus.CONFLICT)
public class ApiException extends RuntimeException {
  private static final long serialVersionUID = 1L;

  public ApiException(String msg) {
    super(msg);
  }
}
