const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const register = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "Заполните все обязательные поля"
            });
        }

        const [existingUser] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                message: "Пользователь с таким email уже существует"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
            [full_name, email, hashedPassword, role || "employee"]
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [result.insertId, "Регистрация пользователя"]
        );

        res.status(201).json({
            message: "Пользователь успешно зарегистрирован"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка регистрации пользователя",
            error: error.message
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Введите email и пароль"
            });
        }

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Неверный email или пароль"
            });
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [user.id, "Неудачная попытка входа"]
            );

            return res.status(401).json({
                message: "Неверный email или пароль"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [user.id, "Вход в систему"]
        );

        res.json({
            message: "Вход выполнен успешно",
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка входа",
            error: error.message
        });
    }
};

module.exports = {
    register,
    login
};