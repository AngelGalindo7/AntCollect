package com.petrcollect.messaging.message;

import jakarta.persistence.*;

@Entity
@Table(name = "message_reactions",
       uniqueConstraints = @UniqueConstraint(columnNames = {"message_id","user_id","reaction"}))
public class MessageReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "reaction", nullable = false, length = 10)
    private String reaction;

    public Long getId()                 { return id; }
    public Message getMessage()         { return message; }
    public void setMessage(Message m)   { this.message = m; }
    public Long getUserId()             { return userId; }
    public void setUserId(Long u)       { this.userId = u; }
    public String getReaction()         { return reaction; }
    public void setReaction(String r)   { this.reaction = r; }
}
