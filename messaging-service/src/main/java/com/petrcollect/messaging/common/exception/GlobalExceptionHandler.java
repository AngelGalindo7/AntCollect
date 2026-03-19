package com.petrcollect.messaging.common.exception;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;
@ControllerAdvice
public class GlobalExceptionHandler {


    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleEntityNotFound(EntityNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "Not Found", ex.getMessage());
    }


    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return build(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());
    }

    /**
 * Handles AccessDeniedException thrown by @PreAuthorize/@Secured methods
 * or application code only. 403s rejected at the filter chain (e.g. missing/invalid
 * token) never reach this handler — those are handled/should by SecurityConfig#accessDeniedHandler.
 */ 
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "Forbidden", "Access denied");
    }
    

    @ExceptionHandler(ConversationAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleConversationAlreadyExists(
        ConversationAlreadyExistsException ex) {
      return build(HttpStatus.CONFLICT, "Conflict",
            "Conversation already exists: " + ex.getConversationId());
}

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception ex) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal Server Error", "Internal server error");
    }

    private ResponseEntity<Map<String, String>> build(HttpStatus status, String error, String message) {
        Map<String, String> body = Map.of(
                "error",   error,
                "message", message != null ? message : status.getReasonPhrase()
        );
        return ResponseEntity.status(status).body(body);
    }
}
