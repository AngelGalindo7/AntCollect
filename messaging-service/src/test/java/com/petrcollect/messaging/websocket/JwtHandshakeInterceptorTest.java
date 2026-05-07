package com.petrcollect.messaging.websocket;

import com.petrcollect.messaging.util.TestJwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class JwtHandshakeInterceptorTest {

    @LocalServerPort
    private int port;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    private WebSocketStompClient stompClient;

    @BeforeEach
    void setUp() {
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
    }

    @AfterEach
    void tearDown() {
        stompClient.stop();
    }

    // DECOMMISSIONED 2026-05-06: messaging service — see docs/RECOMMISSION_TRADING_MESSAGING.md
    @Disabled("WebSocket endpoint /ws unregistered while messaging is decommissioned")
    @Test
    void connect_withValidCookie_sessionEstablished() throws Exception {
        String token = TestJwtUtil.generateToken(2001L, jwtSecret);

        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Cookie", "access_token=" + token);
        // Origin must match setAllowedOrigins in WebSocketConfig
        headers.add("Origin", "http://localhost:5173");

        var session = stompClient
                .connectAsync("ws://localhost:" + port + "/ws", headers,
                        new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);

        assertTrue(session.isConnected());
        session.disconnect();
    }

    @Test
    void connect_withInvalidToken_upgradeRejected() {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Cookie", "access_token=not.a.valid.jwt");
        headers.add("Origin", "http://localhost:5173");

        assertThrows(ExecutionException.class, () ->
                stompClient
                        .connectAsync("ws://localhost:" + port + "/ws", headers,
                                new StompSessionHandlerAdapter() {})
                        .get(5, TimeUnit.SECONDS)
        );
    }

    @Test
    void connect_noCookie_upgradeRejected() {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Origin", "http://localhost:5173");

        assertThrows(ExecutionException.class, () ->
                stompClient
                        .connectAsync("ws://localhost:" + port + "/ws", headers,
                                new StompSessionHandlerAdapter() {})
                        .get(5, TimeUnit.SECONDS)
        );
    }
}
