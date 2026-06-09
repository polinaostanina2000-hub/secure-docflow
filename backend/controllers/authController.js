const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const fullNameRegex = /^[А-Яа-яЁёA-Za-z\s-]+$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateUserFields = (full_name, email, password) => {
    if (!full_name || !email || !password) {
        return "Заполните все обязательные поля";
    }

    if (!fullNameRegex.test(full_name.trim())) {
        return "ФИО может содержать только буквы, пробелы и дефис";
    }

    if (!emailRegex.test(email.trim())) {
        return "Некорректный email. Email должен содержать @ и домен";
    }

    if (password.trim().length < 3) {
        return "Пароль должен содержать минимум 3 символа";
    }

    return null;
};

const register = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        const validationError = validateUserFields(
            full_name,
            email,
            password
        );

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const [existingUser] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email.trim()]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                message: "Пользователь с таким email уже существует"
            });
        }

        const hashedPassword = await bcrypt.hash(
            password.trim(),
            10
        );

        const [result] = await db.query(
            "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
            [
                full_name.trim(),
                email.trim(),
                hashedPassword,
                role || "employee"
            ]
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

        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({
                message: "Некорректный email"
            });
        }

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email.trim()]
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