package com.petrcollect.messaging.message;

import com.petrcollect.messaging.conversation.Conversation;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"}) // Add this at the class level
@Entity
@Table(name = "messages")
public class Message {

    @Id
    @Column(name = "message_id")
    private Long messageId;             

    @Column(name = "client_message_id", nullable = false, unique = false)
    private UUID clientMessageId;      

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    @JsonIgnoreProperties({"lastMessage", "participants"}) 
    private Conversation conversation;

    @Column(name = "sender", nullable = false)
    private Long sender;                

    @Column(name = "time_sent", nullable = false)
    private OffsetDateTime timeSent;

    @Column(name = "edited_at")
    private OffsetDateTime editedAt;    

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reply_to_message_id", nullable = true)
    private Message replyTo;            

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 10)
    private ContentType contentType;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;   

    public enum ContentType {
        text, image, video, audio, file
    }

    public Long getMessageId()                           { return messageId; }
    public void setMessageId(Long messageId)             { this.messageId = messageId; }
    public UUID getClientMessageId()                     { return clientMessageId; }
    public void setClientMessageId(UUID id)              { this.clientMessageId = id; }
    public Conversation getConversation()                { return conversation; }
    public void setConversation(Conversation c)          { this.conversation = c; }
    public Long getSender()                              { return sender; }
    public void setSender(Long sender)                   { this.sender = sender; }
    public OffsetDateTime getTimeSent()                  { return timeSent; }
    public void setTimeSent(OffsetDateTime t)             { this.timeSent = t; }
    public OffsetDateTime getEditedAt()                  { return editedAt; }
    public void setEditedAt(OffsetDateTime t)             { this.editedAt = t; }
    public Message getReplyTo()                          { return replyTo; }
    public void setReplyTo(Message m)                    { this.replyTo = m; }
    public String getContent()                           { return content; }
    public void setContent(String content)               { this.content = content; }
    public ContentType getContentType()                  { return contentType; }
    public void setContentType(ContentType t)            { this.contentType = t; }
    public OffsetDateTime getDeletedAt()                 { return deletedAt; }
    public void setDeletedAt(OffsetDateTime t)            { this.deletedAt = t; }
    public boolean isDeleted()                           { return deletedAt != null; }
}
