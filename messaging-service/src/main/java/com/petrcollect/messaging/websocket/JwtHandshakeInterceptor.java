package com.petrcollect.messaging.websocket;

import com.petrcollect.messaging.auth.JwtService;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.http.HttpStatus;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.ServletServerHttpRequest;

import java.net.URI;
import java.util.Map;

/**
 * Validates the JWT token during the WebSocket upgrade handshake.
 *
 * WHY HERE and not in the Security filter chain:
 * Spring Security filters are HTTP-scoped. Once the connection upgrades to
 * WebSocket, HTTP filters no longer apply to individual frames. The handshake
 * is the only HTTP moment we have — so this is the right place to authenticate.
 *
 * HOW THE TOKEN ARRIVES:
 * Browsers cannot set custom headers on WebSocket upgrade requests. The JWT
 * access token is therefore sent as a query parameter:
 *   ws://host/ws?token=eyJhbGci...
 *
 * WHAT HAPPENS ON SUCCESS:
 * userId is extracted from the validated JWT claims and stored in the
 * WebSocket session attributes under the key "userId". Downstream handlers
 * (MessageWebSocketHandler, SessionRegistry) read it from there.
 *
 * WHAT HAPPENS ON FAILURE:
 * beforeHandshake() returns false — Spring rejects the upgrade with 401.
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;

    public JwtHandshakeInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

    if (request instanceof ServletServerHttpRequest servletRequest) {
        jakarta.servlet.http.HttpServletRequest httpRequest = servletRequest.getServletRequest();
        jakarta.servlet.http.Cookie[] cookies = httpRequest.getCookies();

        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if ("access_token".equals(cookie.getName())) {
                    String token = cookie.getValue();
                    try {
                        
                        if (token == null) {
        // Force a 401 instead of letting it default to 200
        response.setStatusCode(HttpStatus.UNAUTHORIZED); 
        return false; 
    }
                        if (jwtService.isValid(token)) {
                            Long userId = jwtService.extractUserId(token);
                            attributes.put("userId", userId); // Still goes to attributes
                            return true; // Success!
                        }
                    } catch (Exception e) {
                        return false; 
                    }
                }
            }
        }
    }
    return false; // No valid cookie found, returns 200/403 to browser
}/*
        String path = request.getURI().getPath();
    
    // Allow SockJS info + iframe probes — these have no token
    if (path.endsWith("/info") || path.contains("/iframe")) {
        return true;
    }
        URI uri = request.getURI();
        String query = uri.getQuery(); // e.g. "token=eyJhbGci..."

        if (query == null) {
            return false; // no query string at all — reject
        }

        String token = null;
        for (String param : query.split("&")) {
            if (param.startsWith("token=")) {
                token = param.substring("token=".length());
                break;
            }
        }

        if (token == null || token.isBlank()) {
            return false; // token param missing or empty — reject
        }

        try {
            if (!jwtService.isValid(token)) {
                return false; // expired, bad signature, etc — reject
            }
            Long userId = jwtService.extractUserId(token);
            attributes.put("userId", userId); // available to all downstream handlers
            return true;
        } catch (Exception e) {
            // Any parse or validation exception means the token is bad — reject
            return false;
        }
    }*/

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // no-op — nothing to do after the handshake completes
    }
}
