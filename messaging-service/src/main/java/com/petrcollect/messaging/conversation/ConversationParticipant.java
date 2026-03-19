package com.petrcollect.messaging.conversation;

import com.petrcollect.messaging.message.Message;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.io.Serializable;

@Entity
@Table(name = "conversation_participants")
public class ConversationParticipant {

    @EmbeddedId
    private ParticipantId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("conversationId")           
    @JoinColumn(name = "conversation_id")
    private Conversation conversation;

    @Column(name = "joined_at", nullable = false)
    private OffsetDateTime joinedAt;

    @Column(name = "left_at")
    private OffsetDateTime leftAt;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_read_message_id", nullable = true)
    private Message lastReadMessage;   

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 10)
    private Role role;                  

    public enum Role { member, admin }

    @Embeddable
    public static class ParticipantId implements Serializable {
        @Column(name = "conversation_id")
        private Long conversationId;

        @Column(name = "user_id")
        private Long userId;

        public ParticipantId() {}
        public ParticipantId(Long conversationId, Long userId) {
            this.conversationId = conversationId;
            this.userId = userId;
        }
        @Override public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof ParticipantId p)) return false;
            return conversationId.equals(p.conversationId) && userId.equals(p.userId);
        }
        @Override public int hashCode() {
            return 31 * conversationId.hashCode() + userId.hashCode();
        }
        public Long getConversationId() { return conversationId; }
        public Long getUserId()         { return userId; }
    }

    public ParticipantId getId()                         { return id; }
    public void setId(ParticipantId id)                  { this.id = id; }
    public Conversation getConversation()                { return conversation; }
    public void setConversation(Conversation c)          { this.conversation = c; }
    public OffsetDateTime getJoinedAt()                  { return joinedAt; }
    public void setJoinedAt(OffsetDateTime t)             { this.joinedAt = t; }
    public OffsetDateTime getLeftAt()                    { return leftAt; }
    public void setLeftAt(OffsetDateTime t)               { this.leftAt = t; }
    public boolean isActive()                            { return isActive; }
    public void setActive(boolean active)                { isActive = active; }
    public Message getLastReadMessage()                  { return lastReadMessage; }
    public void setLastReadMessage(Message m)            { this.lastReadMessage = m; }
    public Role getRole()                                { return role; }
    public void setRole(Role role)                       { this.role = role; }
}
