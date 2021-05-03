package org.vrspace.server.core;

/**
 * Thrown when the session needs to be terminated.
 * 
 * @author joe
 *
 */
public class SessionException extends Exception {
  private static final long serialVersionUID = 1L;

  public SessionException(String string) {
    super(string);
  }

}
