package com.petrcollect.messaging.message;

import jakarta.persistence.*;

@Entity
@Table(name = "message_statuses")
public class MessageStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private Status status;

    public enum Status { sent, delivered, read }

    public Long getId()               { return id; }
    public Message getMessage()       { return message; }
    public void setMessage(Message m) { this.message = m; }
    public Long getUserId()           { return userId; }
    public void setUserId(Long u)     { this.userId = u; }
    public Status getStatus()         { return status; }
    public void setStatus(Status s)   { this.status = s; }
}
