package com.petrcollect.messaging.user;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable                          
@Table (name = "users", schema = "public")            
public class User {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "avatar_path")
    private String avatarPath;



    public Long getId()       { return id; }
    public String getUsername() { return username; }
    public String getEmail()  { return email; }
    public String getAvatarPath() { return avatarPath; }
}

