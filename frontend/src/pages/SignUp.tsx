import React, { useState } from 'react';

const SignUp: React.FC = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    //Error checking for passwords match
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!isEmail.test(email)) {
            setError("Incorrect email")
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        
        
    

    try {
        const res = await fetch("http://127.0.0.1:8000/users/create-user",{
          method: "POST",
          headers: { "Content-Type": "application/json"},
          body: JSON.stringify({
            username,
            email,
            password,
            //confirm_password: confirmPassword
          }),
        });

        const data = await res.json();

        console.log("Response from backend", data);

        if (!res.ok) {
          setError(data.detail || "Something went wrong.");
          return;
        }
        //replace with real backend fetch call
        //await fetch("/api/signup", {...})

        setSuccess(data.msg || "Account created successfully!");
    } catch (err) { 
        console.error("Network Error:", err);
        setError("Network error.");
    }
};

    return (

        <div
  style={{
    maxWidth: 400,
    margin: "50px auto",
    padding: 20,
    border: "1px solid #ccc",
    borderRadius: 8,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    fontFamily: "Arial, sans-serif"
  }}
>
  <h2 style={{ textAlign: "center", marginBottom: 20 }}>Sign Up</h2>
  <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
    <label>Username</label>
    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}/>

    <label>Email</label>
    <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}/>

    <label>Password</label>
    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}/>

    <label>Confirm Password</label>
    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}/>

    <button type="submit" style={{ padding: 10, borderRadius: 4, backgroundColor: "#4caf50", color: "white", fontWeight: "bold", border: "none", cursor: "pointer" }}>Create Account</button>
  </form>

  {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
  {success && <p style={{ color: "green", marginTop: 10 }}>{success}</p>}
</div>

    );

};

export default SignUp