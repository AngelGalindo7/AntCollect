package com.petrcollect.messaging.conversation;

import com.petrcollect.messaging.util.TestJwtUtil;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.concurrent.ThreadLocalRandom;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ConversationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void listConversations_withValidCookie_returns200() throws Exception {
        String token = TestJwtUtil.generateToken(1001L, jwtSecret);

        mockMvc.perform(get("/conversations")
                        .cookie(new Cookie("access_token", token)))
                .andExpect(status().isOk());
    }

    // If this returns 403 instead of 401, SecurityConfig needs an explicit
    // AuthenticationEntryPoint: .exceptionHandling(e -> e.authenticationEntryPoint(
    //     (req, res, ex) -> res.sendError(401)))
    @Test
    void listConversations_noCookie_returns401() throws Exception {
        mockMvc.perform(get("/conversations"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createConversation_withValidCookie_returns201() throws Exception {
        // Randomised IDs — conversation_participant.user_id has no DB-enforced FK,
        // so any Long is valid. Random avoids ConversationAlreadyExistsException (409)
        // on repeated runs against the persistent test DB.
        long currentUser = ThreadLocalRandom.current().nextLong(100_000L, Long.MAX_VALUE / 2);
        long otherUser   = ThreadLocalRandom.current().nextLong(100_000L, Long.MAX_VALUE / 2);
        String token = TestJwtUtil.generateToken(currentUser, jwtSecret);

        String body = String.format(
                "{\"userIds\":[%d,%d],\"isGroup\":false,\"groupName\":null}",
                currentUser, otherUser
        );

        mockMvc.perform(post("/conversations")
                        .cookie(new Cookie("access_token", token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());
    }
}
