package com.petrcollect.messaging.websocket;

import com.petrcollect.messaging.auth.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServletServerHttpRequest;

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
 * The JWT access token is sent as an httpOnly cookie (access_token).
 * Browsers send cookies automatically on WebSocket upgrade requests to the same origin.
 *
 * WHAT HAPPENS ON SUCCESS:
 * userId is extracted from the validated JWT claims and stored in the
 * WebSocket session attributes under the key "userId". Downstream handlers
 * (MessageWebSocketHandler, SessionRegistry) read it from there.
 *
 * WHAT HAPPENS ON FAILURE:
 * beforeHandshake() returns false — Spring rejects the upgrade. Each failure
 * path is logged at WARNING with a distinct reason for security observability.
 */
@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    private final JwtService jwtService;
    private final WebSocketConnectionLimiter connectionLimiter;

    public JwtHandshakeInterceptor(JwtService jwtService,
                                   WebSocketConnectionLimiter connectionLimiter) {
        this.jwtService = jwtService;
        this.connectionLimiter = connectionLimiter;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        String clientIp = request.getRemoteAddress() != null
                ? request.getRemoteAddress().getAddress().getHostAddress()
                : "unknown";

        if (request instanceof ServletServerHttpRequest servletRequest) {
            jakarta.servlet.http.Cookie[] cookies =
                    servletRequest.getServletRequest().getCookies();

            if (cookies != null) {
                for (jakarta.servlet.http.Cookie cookie : cookies) {
                    if ("access_token".equals(cookie.getName())) {
                        String token = cookie.getValue();

                        if (token == null || token.isBlank()) {
                            log.warn("WS handshake rejected — empty access_token cookie, ip={}", clientIp);
                            response.setStatusCode(HttpStatus.UNAUTHORIZED);
                            return false;
                        }

                        try {
                            if (!jwtService.isValid(token)) {
                                log.warn("WS handshake rejected — invalid JWT, ip={}", clientIp);
                                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                                return false;
                            }

                            Long userId = jwtService.extractUserId(token);

                            if (!connectionLimiter.tryConnect(userId)) {
                                log.warn("WS handshake rejected — connection limit reached, userId={}", userId);
                                response.setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                                return false;
                            }

                            attributes.put("userId", userId);
                            log.debug("WS handshake accepted, userId={}", userId);
                            return true;

                        } catch (Exception e) {
                            log.warn("WS handshake rejected — JWT parse error, ip={}", clientIp);
                            response.setStatusCode(HttpStatus.UNAUTHORIZED);
                            return false;
                        }
                    }
                }
            }
        }

        log.warn("WS handshake rejected — no access_token cookie, ip={}", clientIp);
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // no-op
    }
}
