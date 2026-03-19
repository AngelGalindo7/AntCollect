package com.petrcollect.messaging.conversation;

import com.petrcollect.messaging.message.Message;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"}) // Add this at the class level
@Entity
@Table(name = "conversations")
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_name", length = 100)
    private String groupName;                           // nullable — null for DMs

    @Column(name = "group_avatar", length = 255)
    private String groupAvatar;                         // nullable

    // Nullable FK back to Message. Stays nullable forever.
    // DEFERRABLE INITIALLY DEFERRED in DB handles circular write ordering.
    // In JPA: insertable=false, updatable=false here because we manage this
    // field by calling setLastMessage() and saving via the service layer.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_message_id", nullable = true)
    @JsonIgnoreProperties("conversation") // Ignore the field that links back to Conversation
    private Message lastMessage;

    @Column(name = "last_activity_at", nullable = false)
    private OffsetDateTime lastActivityAt;

    @Column(name = "is_group", nullable = false)
    private boolean isGroup;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = OffsetDateTime.now();
        lastActivityAt = OffsetDateTime.now();
    }

    // --- Getters & Setters ---
    public Long getId()                          { return id; }
    public String getGroupName()                 { return groupName; }
    public void setGroupName(String groupName)   { this.groupName = groupName; }
    public String getGroupAvatar()               { return groupAvatar; }
    public void setGroupAvatar(String g)         { this.groupAvatar = g; }
    public Message getLastMessage()              { return lastMessage; }
    public void setLastMessage(Message m)        { this.lastMessage = m; }
    public OffsetDateTime getLastActivityAt()    { return lastActivityAt; }
    public void setLastActivityAt(OffsetDateTime t) { this.lastActivityAt = t; }
    public boolean isGroup()                     { return isGroup; }
    public void setGroup(boolean group)          { isGroup = group; }
    public OffsetDateTime getCreatedAt()         { return createdAt; }
}
