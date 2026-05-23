import { useState } from "react";
import axios from "axios";

function App() {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const login = async () => {

        try {

            const response = await axios.post(
                "http://localhost:5000/api/auth/login",
                {
                    email,
                    password
                }
            );

            localStorage.setItem(
                "token",
                response.data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(response.data.user)
            );

            window.location.href = "/dashboard";

            console.log(response.data);

        } catch (error) {

            alert(
                error.response?.data?.message ||
                "Ошибка входа"
            );

        }

    };

    return (
        <div style={styles.container}>

            <div style={styles.card}>

                <h1 style={styles.title}>
                    Вход в систему
                </h1>

                <input
                    type="email"
                    placeholder="Email"
                    style={styles.input}
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                />

                <input
                    type="password"
                    placeholder="Пароль"
                    style={styles.input}
                    value={password}
                    onChange={(e) =>
                        setPassword(e.target.value)
                    }
                />

                <button
                    style={styles.button}
                    onClick={login}
                >
                    Войти
                </button>

            </div>

        </div>
    );
}

const styles = {

    container: {
        width: "100%",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f7fb"
    },

    card: {
        width: "350px",
        background: "white",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 0 20px rgba(0,0,0,0.1)"
    },

    title: {
        textAlign: "center",
        marginBottom: "30px",
        color: "#1f2937"
    },

    input: {
        width: "100%",
        padding: "12px",
        marginBottom: "15px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        fontSize: "16px"
    },

    button: {
        width: "100%",
        padding: "12px",
        background: "#2563eb",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "16px"
    }

};

export default App;