const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

app.get("/", async (req, res) => {
    try {
        const connection = await db.getConnection();
        connection.release();

        res.send("SecureDocFlow API и MySQL работают");
    } catch (error) {
        res.status(500).send("Ошибка подключения к MySQL");
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});